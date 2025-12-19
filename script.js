const boardEl = document.getElementById('board');
const blackScoreEl = document.getElementById('black-score');
const whiteScoreEl = document.getElementById('white-score');
const messageEl = document.getElementById('message');
const resetBtn = document.getElementById('reset-btn');
const aiLevelSelect = document.getElementById('ai-level');

let board = [];
let currentPlayer = 1; 
let isAnimating = false;

const weights = [
    [100, -40, 20,  5,  5, 20, -40, 100],
    [-40, -60, -5, -5, -5, -5, -60, -40],
    [ 20,  -5, 10,  3,  3, 10,  -5,  20],
    [  5,  -5,  3,  1,  1,  3,  -5,   5],
    [  5,  -5,  3,  1,  1,  3,  -5,   5],
    [ 20,  -5, 10,  3,  3, 10,  -5,  20],
    [-40, -60, -5, -5, -5, -5, -60, -40],
    [100, -40, 20,  5,  5, 20, -40, 100]
];

function init() {
    board = Array(8).fill().map(() => Array(8).fill(0));
    board[3][3] = 2; board[3][4] = 1;
    board[4][3] = 1; board[4][4] = 2;
    currentPlayer = 1;
    isAnimating = false;
    messageEl.textContent = "輪到黑棋 (玩家)";
    render();
}

function getLogicalFlipSequence(r, c, color) {
    if (board[r][c] !== 0) return [];
    const dirs = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
    let sequence = [];
    dirs.forEach(([dr, dc]) => {
        let path = [];
        let currR = r + dr, currC = c + dc;
        while(currR >= 0 && currR < 8 && currC >= 0 && currC < 8 && board[currR][currC] === (3 - color)) {
            path.push({r: currR, c: currC, dist: Math.hypot(currR - r, currC - c)});
            currR += dr; currC += dc;
        }
        if(currR >= 0 && currR < 8 && currC >= 0 && currC < 8 && board[currR][currC] === color) {
            sequence = sequence.concat(path);
        }
    });
    return sequence.sort((a, b) => a.dist - b.dist);
}

function render() {
    if (isAnimating) return;
    boardEl.innerHTML = '';
    let b = 0, w = 0;
    for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
            const val = board[r][c];
            if(val === 1) b++; else if(val === 2) w++;
            const cell = document.createElement('div');
            cell.className = 'cell';
            if(currentPlayer === 1 && val === 0) {
                const seq = getLogicalFlipSequence(r, c, 1);
                if(seq.length > 0) {
                    cell.classList.add('hint');
                    cell.onclick = (function(row, col, s) {
                        return function() { processMove(row, col, s); };
                    })(r, c, seq);
                }
            }
            if(val !== 0) {
                const piece = document.createElement('div');
                piece.className = `piece ${val === 1 ? 'black' : 'white'}`;
                piece.innerHTML = '<div class="face front"></div><div class="face back"></div>';
                cell.appendChild(piece);
            }
            boardEl.appendChild(cell);
        }
    }
    blackScoreEl.textContent = b;
    whiteScoreEl.textContent = w;
}

async function processMove(r, c, sequence) {
    if(isAnimating) return;
    isAnimating = true;

    // 關鍵修復：落子瞬間手動立即顯示棋子，不等待渲染
    board[r][c] = currentPlayer;
    const targetCell = boardEl.children[r * 8 + c];
    targetCell.classList.remove('hint');
    const newPiece = document.createElement('div');
    newPiece.className = `piece ${currentPlayer === 1 ? 'black' : 'white'}`;
    newPiece.innerHTML = '<div class="face front"></div><div class="face back"></div>';
    targetCell.appendChild(newPiece);
    
    // 稍微等待落盤感覺
    await new Promise(res => setTimeout(res, 250));

    // 依序執行側向翻轉
    for(const target of sequence) {
        const piece = boardEl.children[target.r * 8 + target.c].querySelector('.piece');
        if (piece) {
            piece.classList.remove('flipping-to-white', 'flipping-to-black');
            void piece.offsetWidth; // 觸發重繪
            piece.classList.add(currentPlayer === 1 ? 'flipping-to-black' : 'flipping-to-white');
            board[target.r][target.c] = currentPlayer;
        }
        await new Promise(res => setTimeout(res, 120)); 
    }

    await new Promise(res => setTimeout(res, 600));
    isAnimating = false;
    currentPlayer = 3 - currentPlayer;
    updateGameFlow();
}

function updateGameFlow() {
    const moves = getAvailableMoves(currentPlayer);
    if(moves.length === 0) {
        currentPlayer = 3 - currentPlayer;
        if(getAvailableMoves(currentPlayer).length === 0) endGame();
        else {
            messageEl.textContent = (currentPlayer === 1 ? "玩家" : "電腦") + "跳過回合";
            if (currentPlayer === 2) setTimeout(aiAction, 800); else render();
        }
    } else {
        if (currentPlayer === 2) {
            messageEl.textContent = "電腦思考中...";
            setTimeout(aiAction, 800);
        } else {
            messageEl.textContent = "輪到黑棋 (玩家)";
            render();
        }
    }
}

function aiAction() {
    // 修復：每次行動前即時讀取下拉選單的值
    const currentDifficulty = aiLevelSelect.value;
    const moves = getAvailableMoves(2);
    if(moves.length === 0) return;
    
    let bestMove;
    if(currentDifficulty === 'easy') {
        bestMove = moves[Math.floor(Math.random() * moves.length)];
    } else {
        let maxScore = -Infinity;
        let candidates = [];
        moves.forEach(m => {
            let s = weights[m.r][m.c] + (m.seq.length * 2);
            if(s > maxScore) { maxScore = s; candidates = [m]; }
            else if(s === maxScore) candidates.push(m);
        });
        bestMove = candidates[Math.floor(Math.random() * candidates.length)];
    }
    processMove(bestMove.r, bestMove.c, bestMove.seq);
}

function getAvailableMoves(color) {
    let res = [];
    for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
            const s = getLogicalFlipSequence(r, c, color);
            if(s.length > 0) res.push({r, c, seq: s});
        }
    }
    return res;
}

function endGame() {
    isAnimating = false;
    render();
    const b = parseInt(blackScoreEl.textContent, 10);
    const w = parseInt(whiteScoreEl.textContent, 10);
    messageEl.innerHTML = `遊戲結束！${b > w ? '黑棋獲勝' : b < w ? '白棋獲勝' : '平手'}`;
}

resetBtn.onclick = init;
init();