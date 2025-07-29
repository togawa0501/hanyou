// ▼▼▼ この安全装置を追加 ▼▼▼
const currentPage = window.location.pathname.split('/').pop();
if (currentPage === 'master_history.html') {
    // 認証状態の確定を待ってから、ページの処理を開始する
    auth.onAuthStateChanged((user) => {
        if (user) {
            initializeMasterHistoryPage();
        } else {
            window.location.href = 'index.html';
        }
    });
}
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

function initializeMasterHistoryPage() {
    const tourId = localStorage.getItem('fanclub-tour-id');
    if (!tourId) {
        // このエラーは、通常発生しないはずですが、念のため残しておきます。
        alert("ツアーが選択されていません。");
        window.location.href = 'index.html';
        return;
    }

    const historyTableBody = document.getElementById('history-table-body');
    const csvExportButton = document.getElementById('csv-export-button');
    const resetMasterButton = document.getElementById('reset-master-button');
    
    const tourRef = db.collection("tours").doc(tourId);
    const masterCollectionRef = tourRef.collection("master_distributions");
    
    const MASTER_RESET_PASSWORD = "password456"; 
    let allHistoryData = [];

    masterCollectionRef.orderBy('distributedAt', 'desc').onSnapshot(snapshot => {
        historyTableBody.innerHTML = '';
        allHistoryData = [];
        if (snapshot.empty) {
            historyTableBody.innerHTML = `<tr><td colspan="4">まだ配布履歴がありません。</td></tr>`;
            return;
        }
        snapshot.forEach(doc => {
            const data = doc.data();
            allHistoryData.push(data);
            const tr = document.createElement('tr');
            const date = data.distributedAt.toDate().toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            tr.innerHTML = `<td>${date}</td><td>${data.memberId}</td><td>${data.staffName}</td><td>${data.eventName || '不明'}</td>`;
            historyTableBody.appendChild(tr);
        });
    }, error => {
        console.error("Error fetching master history:", error);
        historyTableBody.innerHTML = '<tr><td colspan="4">履歴の読み込みに失敗しました。</td></tr>';
    });

    resetMasterButton.addEventListener('click', async () => {
        const inputPassword = prompt("【警告】このツアーの全履歴が削除されます。マスターパスワードを入力してください：");
        if (inputPassword !== MASTER_RESET_PASSWORD) {
            if (inputPassword !== null) alert("マスターパスワードが違います。");
            return;
        }
        if (confirm("ツアー全体の履歴と、関連するすべてのイベント履歴が削除されます。本当によろしいですか？")) {
            try {
                const masterSnapshot = await masterCollectionRef.get();
                const batch = db.batch();
                masterSnapshot.forEach(doc => {
                    const data = doc.data();
                    batch.delete(doc.ref);
                    if (data.eventId && data.memberId) {
                        batch.delete(tourRef.collection("events").doc(data.eventId).collection("distributions").doc(data.memberId));
                    }
                });
                await batch.commit();
                alert("ツアー全体の全履歴と、関連するすべてのイベント履歴をリセットしました。");
            } catch(error) {
                console.error("Error resetting all history:", error);
                alert("リセット中にエラーが発生しました。");
            }
        }
    });

    function convertToCSV(data) {
        const headers = "配布日時,会員番号,担当スタッフ,配布イベント";
        const rows = data.map(row => {
            const date = row.distributedAt.toDate().toLocaleString('ja-JP');
            return `"${date}","${row.memberId}","${row.staffName}","${row.eventName || '不明'}"`
        });
        return `${headers}\n${rows.join('\n')}`;
    }

    csvExportButton.addEventListener('click', () => {
        if (allHistoryData.length === 0) {
            alert('出力するデータがありません。');
            return;
        }
        const csvData = convertToCSV(allHistoryData);
        const bom = new Uint8A-rray([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const now = new Date();
        link.download = `master_distribution_history_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}
