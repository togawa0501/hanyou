checkAuthState(); 
let staffEmail = '';

auth.onAuthStateChanged((user) => {
    if (user) {
        staffEmail = user.email;
        initializePage();
    }
});

function initializePage() {
    const tourId = localStorage.getItem('fanclub-tour-id');
    const eventId = localStorage.getItem('fanclub-event-id');
    const eventName = localStorage.getItem('fanclub-event-name');

    if (!tourId || !eventId) {
        alert("ツアーまたはイベントが選択されていません。");
        window.location.href = 'index.html';
        return;
    }
    
    const staffDisplay = document.getElementById('staff-email-display');
    if (staffDisplay) staffDisplay.textContent = staffEmail;
    
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

    // ▼▼▼ データ保存場所の変更 ▼▼▼
    const tourRef = db.collection("tours").doc(tourId);
    const eventCollectionRef = tourRef.collection("events").doc(eventId).collection("distributions");
    const masterCollectionRef = tourRef.collection("master_distributions");
    // ▲▲▲

    function toHalfWidth(str) { if (!str) return ""; return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)); }

    function updateCounters() {
        masterCollectionRef.onSnapshot(snapshot => { totalCountEl.textContent = snapshot.size; });
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        eventCollectionRef.where('distributedAt', '>=', startOfDay).where('distributedAt', '<', endOfDay).onSnapshot(snapshot => { todayCountEl.textContent = snapshot.size; });
    }

    async function handleDistribution(rawMemberId) {
        const memberIdRaw = toHalfWidth(rawMemberId).trim();
        if (!memberIdRaw) { alert("会員番号を入力してください。"); return; }
        if (!/^[0-9]+$/.test(memberIdRaw)) { showAlert('会員番号は半角数字で入力してください。', 'error'); memberIdInput.value = ''; return; }
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
                const distributionData = { memberId, staffName: staffEmail, distributedAt: new Date(), eventId, eventName };
                batch.set(eventCollectionRef.doc(memberId), distributionData);
                batch.set(masterDocRef, distributionData);
                await batch.commit();
                showAlert('配布完了しました！', 'success'); 
            }
        } catch (error) { console.error("Error:", error); showAlert('エラーが発生しました。', 'error'); }
        memberIdInput.value = ''; memberIdInput.disabled = false; submitButton.disabled = false; memberIdInput.focus();
    }

    function showAlert(message, type) {
        const el = document.getElementById('alert-message');
        el.textContent = message; el.className = type; el.style.display = 'block';
        setTimeout(() => { el.style.display = 'none'; }, 6000);
    }

    submitButton.addEventListener('click', () => handleDistribution(memberIdInput.value));
    memberIdInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleDistribution(memberIdInput.value); });
    updateCounters();
    memberIdInput.focus();
}
