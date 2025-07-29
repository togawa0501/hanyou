// ==================================================================
// main.js - 全ページのJavaScript統合ファイル
// ==================================================================

document.addEventListener('DOMContentLoaded', () => {
    const page = window.location.pathname.split('/').pop() || 'index.html';

    // ページに応じて、適切な初期化関数を呼び出す
    switch (page) {
        case 'index.html':
            initializePageIndex();
            break;
        case 'login.html':
            initializeAppLogin();
            break;
        case 'config.html':
            initializeAppConfig();
            break;
        case 'app.html':
            initializeApp();
            break;
        case 'history.html':
            initializeHistoryPage();
            break;
        case 'master_history.html':
            initializeMasterHistoryPage();
            break;
    }
});


// ------------------------------------------------------------------
// 認証関連の共通ロジック
// ------------------------------------------------------------------
const auth = firebase.auth();
const db = firebase.firestore();
const adminEmails = ["chisano_togawa@dwango.co.jp", "dw.hanyou@gmail.com"]; // ★★★【最重要】管理者のメアドをここに設定 ★★★


// ------------------------------------------------------------------
// 1. index.html (ツアー選択ページ) のロジック
// ------------------------------------------------------------------
function initializePageIndex() {
    const tourListDiv = document.getElementById('tour-list');

    async function loadTours() {
        tourListDiv.innerHTML = '<p>ツアーを読み込み中...</p>';
        try {
            const snapshot = await db.collection('tours').orderBy('createdAt', 'desc').get();
            if (snapshot.empty) {
                tourListDiv.innerHTML = '<p>作業可能なツアーがありません。<br>設定ページからツアーを登録してください。</p>';
                return;
            }
            tourListDiv.innerHTML = '';
            snapshot.forEach(doc => {
                const tour = doc.data();
                const link = document.createElement('a');
                link.href = `login.html?tourId=${doc.id}`;
                link.textContent = tour.tourName;
                tourListDiv.appendChild(link);
            });
        } catch (error) {
            console.error("Error loading tours:", error);
            tourListDiv.innerHTML = '<p>ツアーの読み込みに失敗しました。</p>';
        }
    }
    loadTours();
}


// ------------------------------------------------------------------
// 2. login.html のロジック
// ------------------------------------------------------------------
function initializeAppLogin() {
    const params = new URLSearchParams(window.location.search);
    const tourId = params.get('tourId');
    
    if (!tourId) {
        document.body.innerHTML = `<div class="container"><h1>エラー</h1><p>ツアーが指定されていません。</p><p style="margin-top: 20px;">お手数ですが、以下のリンクからTOPページに戻って、もう一度ツアーを選択してください。</p><a href="index.html" style="display:inline-block; margin-top:20px;">TOPページに戻る</a></div>`;
        throw new Error("Tour ID is missing.");
    }
    localStorage.setItem('fanclub-tour-id', tourId);

    const tourTitle = document.getElementById('tour-title');
    const eventSelect = document.getElementById('event-select');
    const configLink = document.getElementById('config-link');
    
    async function loadTourInfo() {
        const tourDoc = await db.collection('tours').doc(tourId).get();
        if (!tourDoc.exists) {
            alert('指定されたツアーが見つかりません。'); window.location.href = 'index.html'; return;
        }
        const tour = tourDoc.data();
        tourTitle.textContent = tour.tourName;
        
        eventSelect.innerHTML = '';
        if (tour.events && tour.events.length > 0) {
            tour.events.forEach(event => {
                const option = document.createElement('option');
                option.value = event.eventId; option.textContent = event.eventName;
                eventSelect.appendChild(option);
            });
        } else {
            eventSelect.innerHTML = '<option>イベントが登録されていません</option>';
        }
    }

    auth.onAuthStateChanged((user) => {
        const loginView = document.getElementById('login-view');
        const eventSelectView = document.getElementById('event-select-view');
        if (user) {
            loginView.classList.add('hidden');
            eventSelectView.classList.remove('hidden');
            document.getElementById('user-email-display').textContent = user.email;
            
            if (adminEmails.includes(user.email)) {
                configLink.classList.remove('hidden');
            } else {
                configLink.classList.add('hidden');
            }

        } else {
            loginView.classList.remove('hidden');
            eventSelectView.classList.add('hidden');
        }
    });

    document.getElementById('login-button').addEventListener('click', () => {
        const email = document.getElementById('email-input').value;
        const password = document.getElementById('password-input').value;
        auth.signInWithEmailAndPassword(email, password).catch(error => {
            const el = document.getElementById('error-message');
            el.textContent = 'メールアドレスまたはパスワードが違います。';
            el.classList.remove('hidden');
        });
    });

    document.getElementById('start-button').addEventListener('click', () => {
        localStorage.setItem('fanclub-event-id', eventSelect.value);
        localStorage.setItem('fanclub-event-name', eventSelect.options[eventSelect.selectedIndex].text);
        window.location.href = 'app.html';
    });

    document.getElementById('logout-link').addEventListener('click', (e) => { e.preventDefault(); auth.signOut(); });
    loadTourInfo();
}


// ------------------------------------------------------------------
// 3. config.html のロジック
// ------------------------------------------------------------------
function initializeAppConfig() {
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

    const tourSelect = document.getElementById('tour-select');
    const deleteTourButton = document.getElementById('delete-tour-button');
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
        div.innerHTML = `<input type="text" class="event-name" placeholder="イベント名" value="${event.eventName}"><input type="text" class="event-id" placeholder="イベントID (半角英数ハイフン)" value="${event.eventId}"><button class="danger-button remove-event-button" type="button">×</button>`;
        eventsContainer.appendChild(div);
    }

    async function loadTours() {
        const snapshot = await db.collection('tours').orderBy('createdAt', 'desc').get();
        tours = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tourSelect.innerHTML = '<option value="">-- 新しいツアーを作成 --</option>';
        tours.forEach(tour => {
            const option = document.createElement('option');
            option.value = tour.id; option.textContent = tour.tourName;
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

    tourSelect.addEventListener('change', () => displayTourDetails(tours.find(t => t.id === tourSelect.value)));
    addEventButton.addEventListener('click', () => addEventInput());
    eventsContainer.addEventListener('click', e => {
        if (e.target.classList.contains('remove-event-button')) e.target.parentElement.remove();
    });

    saveTourButton.addEventListener('click', async () => {
        const tourName = tourNameInput.value.trim();
        if (!tourName) { alert('ツアー名を入力してください。'); return; }
        const events = Array.from(eventsContainer.querySelectorAll('.event-item')).map(item => {
            const eventName = item.querySelector('.event-name').value.trim();
            const eventId = item.querySelector('.event-id').value.trim();
            return { eventName, eventId };
        }).filter(e => e.eventName && e.eventId);
        
        try {
            if (selectedTourId) {
                await db.collection('tours').doc(selectedTourId).update({ tourName, events });
                alert('ツアーを更新しました。');
            } else {
                await db.collection('tours').add({ tourName, events, createdAt: new Date() });
                alert('新しいツアーを作成しました。');
            }
            await loadTours(); displayTourDetails(null);
        } catch (error) { alert('保存に失敗しました。'); }
    });

    deleteTourButton.addEventListener('click', async () => {
        if (!selectedTourId) return;

        const tourToDelete = tours.find(t => t.id === selectedTourId);
        if (!tourToDelete) return;

        // ▼▼▼ ここからが修正箇所です ▼▼▼
        const confirmation = prompt(`【警告】\n「${tourToDelete.tourName}」に関するすべてのデータ（設定、全配布履歴）が完全に削除されます。\n\nこの操作は元に戻せません。\n削除を実行するには、指定された全削除パスワードを入力してください：`);

        if (confirmation !== "neuralizer") {
            if (confirmation !== null) alert("パスワードが一致しません。削除はキャンセルされました。");
            return;
        }
        // ▲▲▲ 修正ここまで ▲▲▲

        try {
            deleteTourButton.disabled = true;
            deleteTourButton.textContent = "削除中...";

            const tourRef = db.collection('tours').doc(selectedTourId);
            const masterRef = tourRef.collection('master_distributions');
            
            const masterSnapshot = await masterRef.get();
            const batch = db.batch();

            masterSnapshot.forEach(doc => {
                const data = doc.data();
                batch.delete(doc.ref);
                if (data.eventId && data.memberId) {
                    const eventDocRef = tourRef.collection("events").doc(data.eventId).collection("distributions").doc(data.memberId);
                    batch.delete(eventDocRef);
                }
            });

            batch.delete(tourRef);
            await batch.commit();
            alert(`ツアー「${tourToDelete.tourName}」を完全に削除しました。`);
            
            await loadTours();
            displayTourDetails(null);

        } catch (error) {
            console.error("Error deleting tour:", error);
            alert('ツアーの削除中にエラーが発生しました。');
        } finally {
            deleteTourButton.disabled = false;
            deleteTourButton.textContent = "このツアーを削除";
        }
    });

    loadTours();
    displayTourDetails(null);
}


// ------------------------------------------------------------------
// 4. app.html のロジック
// ------------------------------------------------------------------
function initializeApp() {
    let staffEmail = '';
    auth.onAuthStateChanged(user => {
        if (!user) { window.location.href = 'index.html'; return; }
        staffEmail = user.email;
        if (staffEmail) runMainApp();
    });

    function runMainApp() {
        const tourId = localStorage.getItem('fanclub-tour-id');
        const eventId = localStorage.getItem('fanclub-event-id');
        const eventName = localStorage.getItem('fanclub-event-name');
        if (!tourId || !eventId) { alert("ツアーまたはイベントが選択されていません。"); window.location.href = 'index.html'; return; }
        
        document.getElementById('staff-email-display').textContent = staffEmail;
        const eventInfoDiv = document.createElement('div');
        eventInfoDiv.className = 'event-info';
        eventInfoDiv.innerHTML = `イベント: <strong>${eventName}</strong>`;
        if (!document.querySelector('.event-info')) document.querySelector('.header').insertAdjacentElement('afterend', eventInfoDiv);

        const memberIdInput = document.getElementById('member-id-input');
        const submitButton = document.getElementById('submit-button');
        const totalCountEl = document.getElementById('total-count');
        const todayCountEl = document.getElementById('today-count');
        const tourRef = db.collection("tours").doc(tourId);
        const eventCollectionRef = tourRef.collection("events").doc(eventId).collection("distributions");
        const masterCollectionRef = tourRef.collection("master_distributions");

        function toHalfWidth(str) { return str ? str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)) : ""; }
        function updateCounters() {
            masterCollectionRef.onSnapshot(snap => totalCountEl.textContent = snap.size);
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
            eventCollectionRef.where('distributedAt', '>=', startOfDay).where('distributedAt', '<', endOfDay).onSnapshot(snap => todayCountEl.textContent = snap.size);
        }
        async function handleDistribution(rawId) {
            const memberIdRaw = toHalfWidth(rawId).trim();
            if (!memberIdRaw) { alert("会員番号を入力してください。"); return; }
            if (!/^[0-9]+$/.test(memberIdRaw)) { showAlert('会員番号は半角数字で入力してください。', 'error'); memberIdInput.value = ''; return; }
            let memberId = memberIdRaw.replace(/^0+(?!$)/, '');
            memberIdInput.disabled = true; submitButton.disabled = true;
            try {
                const masterDoc = await masterCollectionRef.doc(memberId).get();
                if (masterDoc.exists) {
                    showAlert(`【配布済み】\n${masterDoc.data().eventName}で受取済です。`, 'error');
                } else {
                    const batch = db.batch();
                    const data = { memberId, staffName: staffEmail, distributedAt: new Date(), eventId, eventName };
                    batch.set(eventCollectionRef.doc(memberId), data);
                    batch.set(masterCollectionRef.doc(memberId), data);
                    await batch.commit();
                    showAlert('配布完了しました！', 'success'); 
                }
            } catch (e) { showAlert('エラーが発生しました。', 'error'); }
            memberIdInput.value = ''; memberIdInput.disabled = false; submitButton.disabled = false; memberIdInput.focus();
        }
        function showAlert(msg, type) {
            const el = document.getElementById('alert-message');
            el.textContent = msg; el.className = type; el.style.display = 'block';
            setTimeout(() => el.style.display = 'none', 6000);
        }
        submitButton.addEventListener('click', () => handleDistribution(memberIdInput.value));
        memberIdInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleDistribution(memberIdInput.value); });
        updateCounters();
        memberIdInput.focus();
    }
}


// ------------------------------------------------------------------
// 5. history.html のロジック
// ------------------------------------------------------------------
function initializeHistoryPage() {
    auth.onAuthStateChanged(user => { if (!user) window.location.href = 'index.html'; });
    const tourId = localStorage.getItem('fanclub-tour-id');
    const eventId = localStorage.getItem('fanclub-event-id');
    const eventName = localStorage.getItem('fanclub-event-name');
    if (!tourId || !eventId) { alert("ツアー等が選択されていません。"); window.location.href = 'index.html'; return; }

    document.querySelector('.header h2').textContent = `配布履歴 (${eventName})`;
    const tableBody = document.getElementById('history-table-body');
    const tourRef = db.collection("tours").doc(tourId);
    const eventRef = tourRef.collection("events").doc(eventId).collection("distributions");
    const masterRef = tourRef.collection("master_distributions");
    const RESET_PASS = "password123";
    let historyData = [];
    eventRef.orderBy('distributedAt', 'desc').onSnapshot(snap => {
        tableBody.innerHTML = ''; historyData = [];
        if (snap.empty) { tableBody.innerHTML = `<tr><td colspan="3">履歴はありません。</td></tr>`; return; }
        snap.forEach(doc => {
            const data = doc.data(); historyData.push(data);
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${data.distributedAt.toDate().toLocaleString('ja-JP')}</td><td>${data.memberId}</td><td>${data.staffName}</td>`;
            tableBody.appendChild(tr);
        });
    });
    document.getElementById('reset-button').addEventListener('click', async () => {
        const inputPassword = prompt(`【${eventName}】の履歴をリセットします。パスワードを入力:`);
        if (inputPassword !== RESET_PASS) { if (inputPassword !== null) alert("パスワードが違います。"); return; }
        if (!confirm("イベント履歴と全体の履歴の両方から削除されます。よろしいですか？")) return;
        const snap = await eventRef.get(); const batch = db.batch();
        snap.forEach(doc => { batch.delete(doc.ref); batch.delete(masterRef.doc(doc.id)); });
        await batch.commit(); alert("リセットしました。");
    });
    document.getElementById('delete-button').addEventListener('click', async () => {
        const memberId = document.getElementById('delete-member-id-input').value.trim();
        if (!memberId) { alert('会員番号を入力してください。'); return; }
        if (!confirm(`${memberId}の履歴を両方から削除しますか？`)) return;
        const batch = db.batch(); batch.delete(eventRef.doc(memberId)); batch.delete(masterRef.doc(memberId));
        await batch.commit(); alert('削除しました。');
    });
    document.getElementById('search-input').addEventListener('input', e => {
        const searchTerm = e.target.value.toLowerCase();
        Array.from(tableBody.getElementsByTagName('tr')).forEach(row => {
            const cell = row.cells[1];
            if (cell) row.style.display = cell.textContent.toLowerCase().includes(searchTerm) ? '' : 'none';
        });
    });
    document.getElementById('csv-export-button').addEventListener('click', () => {
        if (historyData.length === 0) { alert('出力するデータがありません。'); return; }
        const headers = "配布日時,会員番号,担当スタッフ";
        const rows = historyData.map(row => `"${row.distributedAt.toDate().toLocaleString('ja-JP')}","${row.memberId}","${row.staffName}"`);
        const csv = `${headers}\n${rows.join('\n')}`;
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const now = new Date();
        link.download = `dist_history_${eventId}_${now.toISOString().slice(0,10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}


// ------------------------------------------------------------------
// 6. master_history.html のロジック
// ------------------------------------------------------------------
function initializeMasterHistoryPage() {
    auth.onAuthStateChanged(user => { if (!user) window.location.href = 'index.html'; });
    const tourId = localStorage.getItem('fanclub-tour-id');
    if (!tourId) { alert("ツアーが選択されていません。"); window.location.href = 'index.html'; return; }

    const tableBody = document.getElementById('history-table-body');
    const tourRef = db.collection("tours").doc(tourId);
    const masterRef = tourRef.collection("master_distributions");
    const MASTER_PASS = "master_password_456";
    let historyData = [];
    masterRef.orderBy('distributedAt', 'desc').onSnapshot(snap => {
        tableBody.innerHTML = ''; historyData = [];
        if (snap.empty) { tableBody.innerHTML = `<tr><td colspan="4">履歴はありません。</td></tr>`; return; }
        snap.forEach(doc => {
            const data = doc.data(); historyData.push(data);
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${data.distributedAt.toDate().toLocaleString('ja-JP')}</td><td>${data.memberId}</td><td>${data.staffName}</td><td>${data.eventName || ''}</td>`;
            tableBody.appendChild(tr);
        });
    });
    document.getElementById('reset-master-button').addEventListener('click', async () => {
        const inputPassword = prompt("【警告】このツアーの全履歴が削除されます。パスワードを入力:");
        if (inputPassword !== MASTER_PASS) { if (inputPassword !== null) alert("パスワードが違います。"); return; }
        if (!confirm("ツアー全体の履歴と、関連するすべてのイベント履歴が削除されます。よろしいですか？")) return;
        const snap = await masterRef.get(); const batch = db.batch();
        snap.forEach(doc => {
            const data = doc.data();
            batch.delete(doc.ref);
            if (data.eventId && data.memberId) batch.delete(tourRef.collection("events").doc(data.eventId).collection("distributions").doc(data.memberId));
        });
        await batch.commit(); alert("リセットしました。");
    });
    document.getElementById('csv-export-button').addEventListener('click', () => {
        if (historyData.length === 0) { alert('出力するデータがありません。'); return; }
        const headers = "配布日時,会員番号,担当スタッフ,配布イベント";
        const rows = historyData.map(row => `"${row.distributedAt.toDate().toLocaleString('ja-JP')}","${row.memberId}","${row.staffName}","${row.eventName || ''}"`);
        const csv = `${headers}\n${rows.join('\n')}`;
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const now = new Date();
        link.download = `master_dist_history_${now.toISOString().slice(0,10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}
