/* 简洁的 Tetris (无依赖) */
/* 网格为 10 x 20，使用 canvas 绘制方块 */

(() => {
  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 24; // 每格像素（渲染尺寸），canvas像素尺寸已设置，CSS缩放会自动进行
  const playCanvas = document.getElementById('playfield');
  const nextCanvas = document.getElementById('next');
  const ctx = playCanvas.getContext('2d');
  const nctx = nextCanvas.getContext('2d');

  // 为高清屏幕调整内部像素尺寸（避免模糊）
  function fixCanvas(c, w, h){
    const ratio = window.devicePixelRatio || 1;
    c.width = w * ratio;
    c.height = h * ratio;
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    const g = c.getContext('2d');
    g.setTransform(ratio,0,0,ratio,0,0);
    return g;
  }
  const g = fixCanvas(playCanvas, COLS*BLOCK, ROWS*BLOCK);
  const ng = fixCanvas(nextCanvas, 120, 120);

  // 颜色表
  const COLORS = [
    null,
    '#00f0f0', // I - 青
    '#0000f0', // J - 蓝
    '#f0a000', // L - 橙
    '#f0f000', // O - 黄
    '#00f000', // S - 绿
    '#a000f0', // T - 紫
    '#f00000'  // Z - 红
  ];

  // 7 种方块 模式（矩阵）
  const SHAPES = [
    [],
    [[1,1,1,1]], // I
    [[2,0,0],[2,2,2]], // J
    [[0,0,3],[3,3,3]], // L
    [[4,4],[4,4]], // O
    [[0,5,5],[5,5,0]], // S
    [[0,6,0],[6,6,6]], // T
    [[7,7,0],[0,7,7]]  // Z
  ];

  // 游戏状态
  let arena = createMatrix(COLS, ROWS);
  let player = {
    pos: {x:0,y:0},
    matrix: null,
    next: null,
    score:0,
    level:1
  };

  let dropCounter = 0;
  let dropInterval = 1000;
  let lastTime = 0;
  let gameOver = false;
  let running = false;

  // 工具：创建矩阵
  function createMatrix(w,h){
    const m = [];
    for(let y=0;y<h;y++){
      m.push(new Array(w).fill(0));
    }
    return m;
  }

  // 随机生成方块
  function createPiece(type){
    return SHAPES[type].map(row => row.slice());
  }

  function randomPiece(){
    const id = Math.floor(Math.random()*7)+1;
    return createPiece(id);
  }

  // 碰撞检测
  function collide(arena, player){
    const m = player.matrix;
    const o = player.pos;
    for(let y=0;y<m.length;y++){
      for(let x=0;x<m[y].length;x++){
        if(m[y][x] !== 0 &&
           (arena[y+o.y] && arena[y+o.y][x+o.x]) !== 0){
          return true;
        }
      }
    }
    return false;
  }

  // 合并方块到 arena
  function merge(arena, player){
    player.matrix.forEach((row,y) => {
      row.forEach((value,x) => {
        if(value !== 0){
          arena[y + player.pos.y][x + player.pos.x] = value;
        }
      });
    });
  }

  // 清行，返回清掉的行数
  function sweep(){
    let rowCount = 0;
    outer: for(let y = arena.length - 1; y >= 0; y--){
      for(let x = 0; x < arena[y].length; x++){
        if(arena[y][x] === 0){
          continue outer;
        }
      }

      const row = arena.splice(y,1)[0].fill(0);
      arena.unshift(row);
      y++;
      rowCount++;
    }
    return rowCount;
  }

  // 旋转矩阵（顺时针）
  function rotate(matrix, dir){
    for(let y=0;y<matrix.length;y++){
      for(let x=0;x<y;x++){
        [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
      }
    }
    if(dir > 0){
      matrix.forEach(row => row.reverse());
    } else {
      matrix.reverse();
    }
  }

  // 玩家下落一格
  function playerDrop(){
    player.pos.y++;
    if(collide(arena, player)){
      player.pos.y--;
      merge(arena, player);
      const cleared = sweep();
      if(cleared > 0){
        // 得分规则： 40 * (2^(lines-1)) * level (经典) -> 简化
        const points = [0,40,100,300,1200];
        player.score += points[cleared] * player.level;
        document.getElementById('score').textContent = player.score;
      }
      // 更新等级，降低下落间隔
      const newLevel = Math.floor(player.score / 1000) + 1;
      if(newLevel !== player.level){
        player.level = newLevel;
        dropInterval = Math.max(100, 1000 - (player.level - 1) * 80);
        document.getElementById('level').textContent = player.level;
      }

      player.matrix = player.next || randomPiece();
      player.next = randomPiece();
      player.pos.y = 0;
      player.pos.x = Math.floor(COLS/2) - Math.floor(player.matrix[0].length/2);

      if(collide(arena, player)){
        // 游戏结束
        running = false;
        gameOver = true;
        document.getElementById('startBtn').textContent = '重新开始';
        alert('游戏结束！分数：' + player.score);
      }
      draw();
    }
    dropCounter = 0;
  }

  function playerMove(dir){
    player.pos.x += dir;
    if(collide(arena, player)){
      player.pos.x -= dir;
    }
    draw();
  }

  function playerRotate(){
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, 1);
    while (collide(arena, player)) {
      player.pos.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (Math.abs(offset) > player.matrix[0].length) {
        rotate(player.matrix, -1);
        player.pos.x = pos;
        return;
      }
    }
    draw();
  }

  // 绘制单个格子（带内边）
  function drawBlock(x,y,value,ctxRef){
    const color = COLORS[value] || '#111';
    ctxRef.fillStyle = color;
    ctxRef.fillRect(x*BLOCK, y*BLOCK, BLOCK, BLOCK);

    // 内边（使方块有分隔感）
    ctxRef.strokeStyle = 'rgba(0,0,0,0.35)';
    ctxRef.lineWidth = 1;
    ctxRef.strokeRect(x*BLOCK + 0.5, y*BLOCK + 0.5, BLOCK - 1, BLOCK - 1);
  }

  // 绘制 arena 与 player
  function draw(){
    // 背景
    g.fillStyle = '#071827';
    g.fillRect(0,0,COLS*BLOCK,ROWS*BLOCK);

    // arena
    for(let y=0;y<ROWS;y++){
      for(let x=0;x<COLS;x++){
        if(arena[y][x] !== 0){
          drawBlock(x,y,arena[y][x],g);
        } else {
          // 空格：画网格线（轻微）
          g.strokeStyle = 'rgba(255,255,255,0.02)';
          g.lineWidth = 0.5;
          g.strokeRect(x*BLOCK + 0.5, y*BLOCK + 0.5, BLOCK - 1, BLOCK - 1);
        }
      }
    }

    // player
    const m = player.matrix;
    if(m){
      for(let y=0;y<m.length;y++){
        for(let x=0;x<m[y].length;x++){
          if(m[y][x] !== 0){
            drawBlock(x + player.pos.x, y + player.pos.y, m[y][x], g);
          }
        }
      }
    }

    // 绘制 next canvas
    ng.clearRect(0,0,nextCanvas.width, nextCanvas.height);
    ng.fillStyle = '#071827';
    ng.fillRect(0,0,120,120);
    const nm = player.next;
    if(nm){
      const nx = 1, ny = 1;
      for(let y=0;y<nm.length;y++){
        for(let x=0;x<nm[y].length;x++){
          if(nm[y][x]){
            // 绘制到 next canvas (缩放)
            ng.fillStyle = COLORS[nm[y][x]];
            const size = 20;
            const offsetX = 30;
            const offsetY = 30;
            ng.fillRect(offsetX + x*size, offsetY + y*size, size, size);
            ng.strokeStyle = 'rgba(0,0,0,0.35)';
            ng.lineWidth = 1;
            ng.strokeRect(offsetX + x*size + 0.5, offsetY + y*size + 0.5, size - 1, size - 1);
          }
        }
      }
    }
  }

  // 动画循环
  function update(time = 0){
    if(!running) return;
    const delta = time - lastTime;
    lastTime = time;
    dropCounter += delta;
    if(dropCounter > dropInterval){
      playerDrop();
    }
    draw();
    requestAnimationFrame(update);
  }

  // 初始化 / 重置
  function reset(){
    arena = createMatrix(COLS, ROWS);
    player.matrix = randomPiece();
    player.next = randomPiece();
    player.pos.y = 0;
    player.pos.x = Math.floor(COLS/2) - Math.floor(player.matrix[0].length/2);
    player.score = 0;
    player.level = 1;
    dropInterval = 1000;
    dropCounter = 0;
    lastTime = 0;
    gameOver = false;
    document.getElementById('score').textContent = '0';
    document.getElementById('level').textContent = '1';
    document.getElementById('startBtn').textContent = '开始';
    draw();
  }

  // 事件绑定：键盘
  document.addEventListener('keydown', event => {
    if(!running && event.code === 'Space'){ // 空格重新开始
      startGame();
    }
    if(!running) return;
    if(event.key === 'ArrowLeft'){
      playerMove(-1);
    } else if(event.key === 'ArrowRight'){
      playerMove(1);
    } else if(event.key === 'ArrowDown'){
      playerDrop();
    } else if(event.key === 'ArrowUp' || event.code === 'Space'){
      playerRotate();
    }
  });

  // 按钮绑定
  document.getElementById('startBtn').addEventListener('click', startGame);
  document.getElementById('pauseBtn').addEventListener('click', () => {
    running = !running;
    document.getElementById('pauseBtn').textContent = running ? '暂停' : '继续';
    if(running) {
      lastTime = performance.now();
      requestAnimationFrame(update);
    }
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
    reset();
  });

  document.getElementById('leftBtn').addEventListener('touchstart', e => { e.preventDefault(); playerMove(-1); });
  document.getElementById('rightBtn').addEventListener('touchstart', e => { e.preventDefault(); playerMove(1); });
  document.getElementById('rotateBtn').addEventListener('touchstart', e => { e.preventDefault(); playerRotate(); });
  document.getElementById('dropBtn').addEventListener('touchstart', e => { e.preventDefault(); playerDrop(); });

  // 启动游戏函数
  function startGame(){
    if(gameOver) reset();
    running = true;
    document.getElementById('startBtn').textContent = '进行中';
    lastTime = performance.now();
    requestAnimationFrame(update);
  }

  // 首次加载
  reset();

  // 可视化调整：窗口改变时重新fix canvas
  window.addEventListener('resize', () => {
    fixCanvas(playCanvas, COLS*BLOCK, ROWS*BLOCK);
    fixCanvas(nextCanvas, 120, 120);
    draw();
  });

})();
