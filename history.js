auth.onAuthStateChanged((user) => {
    if (user) initializeHistoryPage();
    else window.location.href = 'index.html';
});

function initializeHistoryPage() {
    const tourId = localStorage.getItem('fanclub-tour-id');
    const eventId = localStorage.getItem('fanclub-event-id');
    const eventName = localStorage.getItem('fanclub-event-name');

    if (!tourId || !eventId) {
        alert("ツアーまたはイベントが選択されていません。");
        window.location.href = 'index.html';
        return;
    }

    document.querySelector('.header h2').textContent = `配布履歴 (${eventName})`;

    const historyTableBody = document.getElementById('history-table-body');
    const deleteMemberIdInput = document.getElementById('delete-member-id-input');
    const deleteButton = document.getElementById('delete-button');
    const csvExportButton = document.getElementById('csv-export-button');
    const searchInput = document.getElementById('search-input');
    const resetButton = document.getElementById('reset-button');
    
    // ▼▼▼ データ保存場所の変更 ▼▼▼
    const tourRef = db.collection("tours").doc(tourId);
    const eventCollectionRef = tourRef.collection("events").doc(eventId).collection("distributions");
    const masterCollectionRef = tourRef.collection("master_distributions");
    // ▲▲▲
    
    const RESET_PASSWORD = "password123"; 
    let allHistoryData = [];

    eventCollectionRef.orderBy('distributedAt', 'desc').onSnapshot(snapshot => {
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
            const date = data.distributedAt.toDate().toLocaleString('ja-JP');
            tr.innerHTML = `<td>${date}</td><td>${data.memberId}</td><td>${data.staffName}</td>`;
            historyTableBody.appendChild(tr);
        });
    }, error => console.error("Error fetching history:", error));

    resetButton.addEventListener('click', async () => {
        if (prompt(`【${eventName}】の全履歴をリセットします。パスワードを入力：`) !== RESET_PASSWORD) {
            alert("パスワードが違います。"); return;
        }
        if (confirm(`イベント履歴と全体の履歴の両方から完全に削除されます。よろしいですか？`)) {
            const snapshot = await eventCollectionRef.get();
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
                batch.delete(masterCollectionRef.doc(doc.id));
            });
            await batch.commit();
            alert(`【${eventName}】の全履歴をリセットしました。`);
        }
    });

    deleteButton.addEventListener('click', async () => {
        const memberId = deleteMemberIdInput.value.trim();
        if (!memberId) { alert('削除する会員番号を入力してください。'); return; }
        if (confirm(`会員番号: ${memberId} の履歴を両方から削除しますか？`)) {
            const batch = db.batch();
            batch.delete(eventCollectionRef.doc(memberId));
            batch.delete(masterCollectionRef.doc(memberId));
            await batch.commit();
            alert('履歴を削除しました。');
            deleteMemberIdInput.value = '';
        }
    });

    searchInput.addEventListener('input', e => { /* ... (省略) ... */ });
    csvExportButton.addEventListener('click', () => { /* ... (省略) ... */ });
}
