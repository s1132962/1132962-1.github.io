const boardEl = document.getElementById('board');
const blackScoreEl = document.getElementById('black-score');
const whiteScoreEl = document.getElementById('white-score');
const messageEl = document.getElementById('message');
const resetBtn = document.getElementById('reset-btn');
const aiLevelSelect = document.getElementById('ai-level');

let board = [];
let currentPlayer = 1; // 1: 黑, 2: 白
let isAnimating = false;

// 強化型權重矩陣：-40 與 -20 的位置是為了誘使對方下在更爛的位置
const weights = [
    [100, -40, 15,  5,  5, 15, -40, 100],
    [-40, -50, -2, -2, -2, -2, -50, -40],
    [ 15,  -2,  5,  2,  2,  5,  -2,  15],
    [  5,  -2,  2,  0,  0,  2,  -2,   5],
    [  5,  -2,  2,  0,  0,  2,  -2,   5],
    [ 15,  -2,  5,  2,  2,  5,  -2,  15],
    [-40, -50, -2, -2, -2, -2, -50, -40],
    [100, -40, 15,  5,  5, 15, -40, 100]
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
            if(val === 1) b++;
            if(val === 2) w++;
            const cell = document.createElement('div');
            cell.className = 'cell';
            
            // 玩家回合提示
            if(currentPlayer === 1 && val === 0) {
                const seq = getLogicalFlipSequence(r, c, 1);
                if(seq.length > 0) {
                    cell.classList.add('hint');
                    cell.onclick = () => processMove(r, c, seq);
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
    
    board[r][c] = currentPlayer;
    render(); 
    
    const newPiece = boardEl.children[r * 8 + c].querySelector('.piece');
    if(newPiece) newPiece.classList.add('flipping');
    
    await new Promise(res => setTimeout(res, 350));
    
    for(const target of sequence) {
        const cell = boardEl.children[target.r * 8 + target.c];
        const piece = cell.querySelector('.piece');
        if (piece) {
            piece.classList.add('flipping');
            board[target.r][target.c] = currentPlayer;
            if (currentPlayer === 1) { 
                piece.classList.remove('white'); piece.classList.add('black'); 
            } else { 
                piece.classList.remove('black'); piece.classList.add('white'); 
            }
        }
        await new Promise(res => setTimeout(res, 100)); 
    }
    
    await new Promise(res => setTimeout(res, 500));
    isAnimating = false;
    currentPlayer = 3 - currentPlayer;
    updateGameFlow();
}

function updateGameFlow() {
    const moves = getAvailableMoves(currentPlayer);
    if(moves.length === 0) {
        currentPlayer = 3 - currentPlayer;
        const nextMoves = getAvailableMoves(currentPlayer);
        if(nextMoves.length === 0) {
            endGame();
        } else {
            messageEl.textContent = (currentPlayer === 1 ? "玩家" : "電腦") + "連續回合！";
            if(currentPlayer === 2) setTimeout(aiAction, 800);
            render();
        }
    } else {
        if(currentPlayer === 2) {
            messageEl.textContent = "電腦思考中...";
            setTimeout(aiAction, 800);
        } else {
            messageEl.textContent = "輪到黑棋 (玩家)";
        }
        render();
    }
}

// 修改點：加強 AI 決策邏輯
function aiAction() {
    const moves = getAvailableMoves(2);
    if(moves.length === 0) return;

    // 每次執行都即時獲取目前選單值
    const currentDifficulty = aiLevelSelect.value;
    let bestMove;

    if(currentDifficulty === 'easy') {
        // 隨機選擇
        bestMove = moves[Math.floor(Math.random() * moves.length)];
    } else {
        // 進階策略：權重評分系統
        let bestScore = -Infinity;
        let candidates = [];

        moves.forEach(move => {
            let score = weights[move.r][move.c];
            
            // 策略加分：如果這手棋能翻轉很多棋子 (穩定度考慮)
            score += move.seq.length * 2;

            // 角落極大化策略
            if ((move.r === 0 || move.r === 7) && (move.c === 0 || move.c === 7)) {
                score += 50; 
            }

            if (score > bestScore) {
                bestScore = score;
                candidates = [move];
            } else if (score === bestScore) {
                candidates.push(move);
            }
        });
        
        // 從評分最高的位置中隨機選一個（增加變幻感）
        bestMove = candidates[Math.floor(Math.random() * candidates.length)];
    }
    
    processMove(bestMove.r, bestMove.c, bestMove.seq);
}

function getAvailableMoves(color) {
    let results = [];
    for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
            const seq = getLogicalFlipSequence(r, c, color);
            if(seq.length > 0) results.push({r, c, seq});
        }
    }
    return results;
}

function endGame() {
    isAnimating = false;
    render();
    const b = parseInt(blackScoreEl.textContent);
    const w = parseInt(whiteScoreEl.textContent);
    messageEl.innerHTML = `<span style="color:#d63031; font-weight:bold;">遊戲結束！ ${b > w ? '黑棋獲勝' : b < w ? '白棋獲勝' : '平手'}</span>`;
}

resetBtn.onclick = init;
init();