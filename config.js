// ▼▼▼【最重要】この配列に、管理者として許可するユーザーのメールアドレスを追加してください ▼▼▼
const adminEmails = ["chisano_togawa@dwango.co.jp", "8214tgwcsn@gmail.com"];
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

const auth = firebase.auth();
const db = firebase.firestore();

// --- 認証と権限チェック ---
auth.onAuthStateChanged((user) => {
    if (user) {
        if (!adminEmails.includes(user.email)) {
            alert("アクセス権限がありません。");
            window.location.href = 'index.html';
        }
    } else {
        window.location.href = 'index.html';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const tourSelect = document.getElementById('tour-select');
    const deleteTourButton = document.getElementById('delete-tour-button');
    const tourConfigForm = document.getElementById('tour-config-form');
    const formTitle = document.getElementById('form-title');
    const tourNameInput = document.getElementById('tour-name');
    const eventsContainer = document.getElementById('events-container');
    const addEventButton = document.getElementById('add-event-button');
    const saveTourButton = document.getElementById('save-tour-button');

    let tours = [];
    let selectedTourId = null;

    function addEventInput(event = { eventName: '', eventId: '' }) {
        const div = document.createElement('div');
        div.className = 'event-item';
        div.innerHTML = `
            <input type="text" class="event-name" placeholder="イベント名" value="${event.eventName}">
            <input type="text" class="event-id" placeholder="イベントID (半角英数ハイフン)" value="${event.eventId}">
            <button class="danger-button remove-event-button" type="button">×</button>
        `;
        eventsContainer.appendChild(div);
    }

    async function loadTours() {
        const snapshot = await db.collection('tours').orderBy('createdAt', 'desc').get();
        tours = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        tourSelect.innerHTML = '<option value="">-- 新しいツアーを作成 --</option>';
        tours.forEach(tour => {
            const option = document.createElement('option');
            option.value = tour.id;
            option.textContent = tour.tourName;
            tourSelect.appendChild(option);
        });
    }

    function displayTourDetails(tour) {
        selectedTourId = tour ? tour.id : null;
        formTitle.textContent = tour ? 'ツアーを編集' : '新しいツアーを作成';
        tourNameInput.value = tour ? tour.tourName : '';
        eventsContainer.innerHTML = '';
        if (tour && tour.events) {
            tour.events.forEach(event => addEventInput(event));
        }
        deleteTourButton.style.display = tour ? 'block' : 'none';
    }

    tourSelect.addEventListener('change', () => {
        const tourId = tourSelect.value;
        const tour = tours.find(t => t.id === tourId);
        displayTourDetails(tour);
    });

    addEventButton.addEventListener('click', () => addEventInput());
    eventsContainer.addEventListener('click', e => {
        if (e.target.classList.contains('remove-event-button')) {
            e.target.parentElement.remove();
        }
    });

    saveTourButton.addEventListener('click', async () => {
        const tourName = tourNameInput.value.trim();
        if (!tourName) {
            alert('ツアー名を入力してください。');
            return;
        }

        const events = [];
        const eventItems = eventsContainer.querySelectorAll('.event-item');
        for (const item of eventItems) {
            const eventName = item.querySelector('.event-name').value.trim();
            const eventId = item.querySelector('.event-id').value.trim();
            if (eventName && eventId) {
                events.push({ eventName, eventId });
            }
        }
        
        try {
            if (selectedTourId) {
                // 更新
                await db.collection('tours').doc(selectedTourId).update({ tourName, events });
                alert('ツアーを更新しました。');
            } else {
                // 新規作成
                await db.collection('tours').add({ tourName, events, createdAt: new Date() });
                alert('新しいツアーを作成しました。');
            }
            await loadTours();
            displayTourDetails(null);
        } catch (error) {
            console.error("Error saving tour:", error);
            alert('保存に失敗しました。');
        }
    });

    deleteTourButton.addEventListener('click', async () => {
        if (selectedTourId && confirm('このツアーと関連する配布履歴をすべて削除します。本当によろしいですか？')) {
            try {
                // 注意：この操作はツアー設定のみを削除します。配布履歴データの削除は別途実装が必要です。
                await db.collection('tours').doc(selectedTourId).delete();
                alert('ツアーを削除しました。');
                await loadTours();
                displayTourDetails(null);
            } catch (error) {
                console.error("Error deleting tour:", error);
                alert('削除に失敗しました。');
            }
        }
    });

    loadTours();
    displayTourDetails(null);
});
