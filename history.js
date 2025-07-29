// 認証状態の確定を待ってから、ページの処理を開始する
auth.onAuthStateChanged((user) => {
    if (user) {
        initializeHistoryPage();
    } else {
        window.location.href = 'index.html';
    }
});

function initializeHistoryPage() {
    const eventId = localStorage.getItem('fanclub-event-id');
    const eventName = localStorage.getItem('fanclub-event-name');

    if (!eventId) {
        alert("イベントが選択されていません。TOPページに戻ります。");
        window.location.href = 'index.html';
        return;
    }

    const header = document.querySelector('.header h2');
    header.textContent = `配布履歴 (${eventName})`;

    const historyTableBody = document.getElementById('history-table-body');
    const deleteMemberIdInput = document.getElementById('delete-member-id-input');
    const deleteButton = document.getElementById('delete-button');
    const csvExportButton = document.getElementById('csv-export-button');
    const searchInput = document.getElementById('search-input');
    const resetButton = document.getElementById('reset-button');

    const eventCollectionRef = db.collection("events").doc(eventId).collection("distributions");
    const masterCollectionRef = db.collection("master_distributions");
    
    const RESET_PASSWORD = "password123"; 

    let allHistoryData = [];

    eventCollectionRef.orderBy('distributedAt', 'desc')
      .onSnapshot(snapshot => {
        historyTableBody.innerHTML = '';
        allHistoryData = [];

        if (snapshot.empty) {
            historyTableBody.innerHTML = `<tr><td colspan="3">このイベントの配布履歴はまだありません。</td></tr>`;
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            allHistoryData.push(data);
            const tr = document.createElement('tr');
            const distributedDate = data.distributedAt.toDate().toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            tr.innerHTML = `<td>${distributedDate}</td><td>${data.memberId}</td><td>${data.staffName}</td>`;
            historyTableBody.appendChild(tr);
        });
      }, error => {
        console.error("Error fetching history: ", error);
        historyTableBody.innerHTML = '<tr><td colspan="3">履歴の読み込みに失敗しました。</td></tr>';
      });

    resetButton.addEventListener('click', async () => {
        const inputPassword = prompt(`【${eventName}】の全履歴をリセットします。パスワードを入力してください：`);
        if (inputPassword === null) return;
        if (inputPassword !== RESET_PASSWORD) {
            alert("パスワードが違います。");
            return;
        }
        if (confirm(`本当によろしいですか？【${eventName}】の配布履歴が、イベント履歴と全体の履歴の両方から完全に削除されます。`)) {
            try {
                const querySnapshot = await eventCollectionRef.get();
                const batch = db.batch();

                querySnapshot.forEach(doc => {
                    const memberId = doc.id;
                    batch.delete(doc.ref);
                    const masterDocRef = masterCollectionRef.doc(memberId);
                    batch.delete(masterDocRef);
                });
                
                await batch.commit();
                alert(`【${eventName}】の全履歴をリセットしました。`);
            } catch (error) {
                console.error("Error resetting history: ", error);
                alert("リセット中にエラーが発生しました。");
            }
        }
    });

    searchInput.addEventListener('input', (e) => { const searchTerm = e.target.value.toLowerCase(); const rows = historyTableBody.getElementsByTagName('tr'); for (const row of rows) { const memberIdCell = row.cells[1]; if (memberIdCell) { const memberIdText = memberIdCell.textContent.toLowerCase(); if (memberIdText.includes(searchTerm)) { row.style.display = ''; } else { row.style.display = 'none'; } } } });
    
    deleteButton.addEventListener('click', async () => {
        const memberIdToDelete = deleteMemberIdInput.value.trim();
        if (!memberIdToDelete) {
            alert('削除する会員番号を入力してください。');
            return;
        }
        if (confirm(`会員番号: ${memberIdToDelete} の配布履歴を、イベント履歴と全体の履歴の両方から削除しますか？`)) {
            try {
                const batch = db.batch();
                const eventDocRef = eventCollectionRef.doc(memberIdToDelete);
                batch.delete(eventDocRef);
                const masterDocRef = masterCollectionRef.doc(memberIdToDelete);
                batch.delete(masterDocRef);
                await batch.commit();
                alert('履歴を削除しました。');
                deleteMemberIdInput.value = '';
            } catch (error) {
                console.error("Error deleting document: ", error);
                alert('削除中にエラーが発生しました。');
            }
        }
    });
    
    function convertToCSV(data) { const headers = "配布日時,会員番号,担当スタッフ"; const rows = data.map(row => { const date = row.distributedAt.toDate().toLocaleString('ja-JP'); return `"${date}","${row.memberId}","${row.staffName}"`; }); return `${headers}\n${rows.join('\n')}`; }
    csvExportButton.addEventListener('click', () => { if (allHistoryData.length === 0) { alert('出力するデータがありません。'); return; } const csvData = convertToCSV(allHistoryData); const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); const blob = new Blob([bom, csvData], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); const url = URL.createObjectURL(blob); link.setAttribute('href', url); const now = new Date(); const fileName = `distribution_history_${eventId}_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.csv`; link.setAttribute('download', fileName); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); });
}
