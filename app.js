checkAuthState(); 
let staffEmail = '';

auth.onAuthStateChanged((user) => {
    if (user) {
        staffEmail = user.email;
        initializePage();
    }
});

function initializePage() {
    const eventId = localStorage.getItem('fanclub-event-id');
    const eventName = localStorage.getItem('fanclub-event-name');

    if (!eventId) {
        alert("イベントが選択されていません。ログインページに戻ります。");
        window.location.href = 'index.html';
        return;
    }
    
    const staffDisplay = document.getElementById('staff-email-display');
    if (staffDisplay) {
        staffDisplay.textContent = staffEmail;
    }
    
    const eventInfoDiv = document.createElement('div');
    eventInfoDiv.className = 'event-info';
    eventInfoDiv.innerHTML = `イベント: <strong>${eventName}</strong>`;
    if (!document.querySelector('.event-info')) {
        document.querySelector('.header').insertAdjacentElement('afterend', eventInfoDiv);
    }

    const memberIdInput = document.getElementById('member-id-input');
    const submitButton = document.getElementById('submit-button');
    const totalCountEl = document.getElementById('total-count');
    const todayCountEl = document.getElementById('today-count');

    const eventCollectionRef = db.collection("events").doc(eventId).collection("distributions");
    const masterCollectionRef = db.collection("master_distributions");

    function toHalfWidth(str) { if (!str) return ""; return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(s) { return String.fromCharCode(s.charCodeAt(0) - 0xFEE0); }); }

    function updateCounters() {
        masterCollectionRef.onSnapshot(snapshot => { totalCountEl.textContent = snapshot.size; });
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        eventCollectionRef.where('distributedAt', '>=', startOfDay).where('distributedAt', '<', endOfDay).onSnapshot(snapshot => { todayCountEl.textContent = snapshot.size; });
    }

    async function handleDistribution(rawMemberId) {
        const memberIdRaw = toHalfWidth(rawMemberId).trim();

        if (!memberIdRaw) {
            alert("会員番号を入力してください。");
            return;
        }

        const numericRegex = /^[0-9]+$/;
        if (!numericRegex.test(memberIdRaw)) {
            showAlert('会員番号は半角数字で入力してください。', 'error');
            memberIdInput.value = '';
            return;
        }

        let memberId = memberIdRaw.replace(/^0+(?!$)/, '');
        
        memberIdInput.disabled = true; submitButton.disabled = true;
        try {
            const masterDocRef = masterCollectionRef.doc(memberId);
            const masterDoc = await masterDocRef.get();
            if (masterDoc.exists) {
                const data = masterDoc.data();
                const previousEventName = data.eventName || '以前のイベント';
                showAlert(`【ツアーで配布済み】\nこの会員は既に「${previousEventName}」で特典を受け取っています。`, 'error');
            } else {
                const batch = db.batch();
                const distributionData = { memberId: memberId, staffName: staffEmail, distributedAt: new Date(), eventId: eventId, eventName: eventName };
                const eventDocRef = eventCollectionRef.doc(memberId);
                batch.set(eventDocRef, distributionData); batch.set(masterDocRef, distributionData);
                await batch.commit();
                showAlert('配布完了しました！', 'success'); 
            }
        } catch (error) { console.error("Error processing distribution: ", error); showAlert('エラーが発生しました。コンソールを確認してください。', 'error'); }
        memberIdInput.value = ''; memberIdInput.disabled = false; submitButton.disabled = false; memberIdInput.focus();
    }

    function showAlert(message, type) {
        const alertMessage = document.getElementById('alert-message');
        alertMessage.textContent = message;
        alertMessage.className = type;
        alertMessage.style.display = 'block';
        setTimeout(() => { alertMessage.style.display = 'none'; }, 6000);
    }

    // --- イベントリスナー ---
    submitButton.addEventListener('click', () => handleDistribution(memberIdInput.value));
    memberIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleDistribution(memberIdInput.value);
        }
    });

    // --- 初期化処理 ---
    updateCounters();
    memberIdInput.focus();
}
