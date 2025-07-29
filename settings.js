// ▼▼▼【最重要】この配列に、管理者として許可するユーザーのメールアドレスを追加してください ▼▼▼
const adminEmails = ["chisano_togawa@dwango.co.jp", "8214tgwcsn@gmail.com"];
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

const auth = firebase.auth();
const db = firebase.firestore();

// --- 認証と権限チェック ---
auth.onAuthStateChanged((user) => {
    if (user) {
        // ログインしているか？
        if (adminEmails.includes(user.email)) {
            // 管理者か？
            initializeSettingsPage();
        } else {
            // 管理者でない場合はTOPページに戻す
            alert("アクセス権限がありません。");
            window.location.href = 'index.html';
        }
    } else {
        // ログインしていない場合はTOPページに戻す
        window.location.href = 'index.html';
    }
});

function initializeSettingsPage() {
    const eventsTableBody = document.getElementById('events-table-body');
    const addEventButton = document.getElementById('add-event-button');
    const newEventNameInput = document.getElementById('new-event-name');
    const newEventIdInput = document.getElementById('new-event-id');

    const eventsConfigRef = db.collection("events_config");

    // --- イベントリストの表示 ---
    function renderEvents(snapshot) {
        eventsTableBody.innerHTML = '';
        if (snapshot.empty) {
            eventsTableBody.innerHTML = '<tr><td colspan="3">イベントが登録されていません。</td></tr>';
            return;
        }
        snapshot.forEach(doc => {
            const event = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${event.eventName}</td>
                <td>${event.eventId}</td>
                <td><button class="danger-button" data-id="${doc.id}">削除</button></td>
            `;
            eventsTableBody.appendChild(tr);
        });
    }

    // リアルタイムでリストを更新
    eventsConfigRef.orderBy("createdAt", "asc").onSnapshot(renderEvents);

    // --- イベントの追加 ---
    addEventButton.addEventListener('click', async () => {
        const eventName = newEventNameInput.value.trim();
        const eventId = newEventIdInput.value.trim();
        const eventIdRegex = /^[a-z0-9-]+$/; // 半角英数（小文字）とハイフンのみ許容

        if (!eventName || !eventId) {
            alert("イベント名とIDの両方を入力してください。");
            return;
        }
        if (!eventIdRegex.test(eventId)) {
            alert("イベントIDは半角英数（小文字）とハイフンのみ使用できます。");
            return;
        }

        try {
            await eventsConfigRef.add({
                eventName: eventName,
                eventId: eventId,
                createdAt: new Date()
            });
            newEventNameInput.value = '';
            newEventIdInput.value = '';
        } catch (error) {
            console.error("Error adding event:", error);
            alert("イベントの追加に失敗しました。");
        }
    });

    // --- イベントの削除 ---
    eventsTableBody.addEventListener('click', async (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.dataset.id) {
            const docId = e.target.dataset.id;
            if (confirm("このイベントを本当に削除しますか？\nこの操作は元に戻せません。")) {
                try {
                    await eventsConfigRef.doc(docId).delete();
                } catch (error) {
                    console.error("Error deleting event:", error);
                    alert("イベントの削除に失敗しました。");
                }
            }
        }
    });
}
