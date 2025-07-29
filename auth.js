// 認証関連の処理をまとめたファイル
const auth = firebase.auth();

// --- ログアウト処理 ---
if (document.getElementById('logout-button')) {
    document.getElementById('logout-button').addEventListener('click', (e) => {
        e.preventDefault();
        auth.signOut().then(() => {
            console.log('Logout successful');
            window.location.href = 'index.html';
        }).catch((error) => {
            console.error('Logout Error:', error);
            alert('ログアウトに失敗しました。');
        });
    });
}

// --- ログイン状態のチェック（ページ保護）---
// ログインが必要なページ（app.html, history.htmlなど）で、
// ログインしていなければログインページに強制的に戻す
function checkAuthState() {
    auth.onAuthStateChanged((user) => {
        if (!user) {
            console.log("User not logged in. Redirecting to login page.");
            // ログインページ自身はリダイレクトさせない
            const currentPage = window.location.pathname.split('/').pop();
            if (currentPage !== 'index.html' && currentPage !== '') {
                window.location.href = 'index.html';
            }
        }
    });
}
