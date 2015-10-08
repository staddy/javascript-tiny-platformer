(function() { // module pattern

  //-------------------------------------------------------------------------
  // POLYFILLS
  //-------------------------------------------------------------------------
  
  if (!window.requestAnimationFrame) { // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
    window.requestAnimationFrame = window.webkitRequestAnimationFrame ||
                                   window.mozRequestAnimationFrame    ||
                                   window.oRequestAnimationFrame      ||
                                   window.msRequestAnimationFrame     ||
                                   function(callback, element) {
                                     window.setTimeout(callback, 1000 / 60);
                                   }
  }

  //-------------------------------------------------------------------------
  // UTILITIES
  //-------------------------------------------------------------------------
  
  function timestamp() {
    return window.performance && window.performance.now ? window.performance.now() : new Date().getTime();
  }

  function bound(x, min, max) {
    return Math.max(min, Math.min(max, x));
  }

  function get(url, onsuccess) {
    var request = new XMLHttpRequest();
    request.onreadystatechange = function() {
      if ((request.readyState == 4) && (request.status == 200))
        onsuccess(request);
    }
    request.open("GET", url, true);
    request.send();
  }

  function overlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return !(((x1 + w1 - 1) < x2) ||
             ((x2 + w2 - 1) < x1) ||
             ((y1 + h1 - 1) < y2) ||
             ((y2 + h2 - 1) < y1))
  }
  
  //-------------------------------------------------------------------------
  // GAME CONSTANTS AND VARIABLES
  //-------------------------------------------------------------------------
  
  var MAP      = { tw: 64, th: 48 },
      //TILE     = 32,
      METER    = TILE,
      GRAVITY  = 9.8 * 6, // default (exagerated) gravity
      MAXDX    = 15,      // default max horizontal speed (15 tiles per second)
      MAXDY    = 60,      // default max vertical speed   (60 tiles per second)
      ACCEL    = 1/2,     // default take 1/2 second to reach maxdx (horizontal acceleration)
      FRICTION = 1/6,     // default take 1/6 second to stop from maxdx (horizontal friction)
      IMPULSE  = 1500,    // default player jump impulse
      COLOR    = { BLACK: '#000000', YELLOW: '#ECD078', BRICK: '#D95B43', PINK: '#C02942', PURPLE: '#542437', GREY: '#333', SLATE: '#53777A', GOLD: 'gold' },
      COLORS   = [ COLOR.YELLOW, COLOR.BRICK, COLOR.PINK, COLOR.PURPLE, COLOR.GREY ],
      KEY      = { SPACE: 32, LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40 };

  var fps      = 60,
      step     = 1/fps,
      canvas   = document.getElementById('canvas'),
      ctx      = canvas.getContext('2d'),
      width    = canvas.width  = MAP.tw * TILE,
      height   = canvas.height = MAP.th * TILE,
      player   = {},
      monsters = [],
      treasure = [],
      bullets  = [],
      cells    = [];
  
  var t2p      = function(t)     { return t*TILE;                  },
      p2t      = function(p)     { return Math.floor(p/TILE);      },
      cell     = function(x,y)   { return tcell(p2t(x),p2t(y));    },
      tcell    = function(tx,ty) { return cells[tx + (ty*MAP.tw)]; };

  // Constants
  var TILE = 32;
  var R = 20;

  // Level
  function Level() {
    this.FRICTION = 0.99;
    this.GRAVITY = 0.3;
    this.entities = [];
    this.walls = [];
    this.entityMap = [];
    this.width = 0;
    this.height = 0;

    var player = null;

    this.spawnX = null;
    this.spawnY = null;

    this._tick = 0;
    this._hits = [];

    this.init = function(w, h, p) {
      this.width = w;
      this.height = h;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          entityMap[x + y * w] = [];
          walls[x + y * w] = 0;
        }
      }

      this.player = p;
      this.add(p);
    };

    this.add = function(e) {
      entities.push(e);
      e.setLevel(this);

      e.xSlot = Math.floor((e.x + e.width / 2.0) / TILE);
      e.ySlot = Math.floor((e.y + e.height / 2.0) / TILE);
      if (e.xSlot >= 0 && e.ySlot >= 0 && e.xSlot < this.width && e.ySlot < this.height) {
        entityMap[e.xSlot + e.ySlot * this.width].add(e);
      }
    };

    this.tick = function() {
      tick++;
      for (var i = 0; i < entities.length; i++) {
        var e = entities[i];
        var xSlotOld = e.xSlot;
        var ySlotOld = e.ySlot;
        if (!e.removed) e.tick();
        e.xSlot = Math.floor((e.x + e.width / 2.0) / TILE);
        e.ySlot = Math.floor((e.y + e.height / 2.0) / TILE);
        if (e.removed) {
          if (xSlotOld >= 0 && ySlotOld >= 0 && xSlotOld < this.width && ySlotOld < this.height) {
            entityMap[xSlotOld + ySlotOld * this.width].splice(i, 1);
          }
          entities.splice(i--, 1);
        } else {
          if (e.xSlot != xSlotOld || e.ySlot != ySlotOld) {
            if (xSlotOld >= 0 && ySlotOld >= 0 && xSlotOld < width && ySlotOld < height) {
              entityMap[xSlotOld + ySlotOld * this.width].remove(e);
            }
            if (e.xSlot >= 0 && e.ySlot >= 0 && e.xSlot < this.width && e.ySlot < this.height) {
              entityMap[e.xSlot + e.ySlot * this.width].add(e);
            } else {
              e.outOfBounds();
            }

          }
        }
      }
    };

    this.getEntities = function(x, y, w, h) {
      hits = [];
      var x0 = Math.floor((x - R) / TILE);
      var y0 = Math.floor((y - R) / TILE);
      var x1 = Math.floor((x + w + R) / TILE);
      var y1 = Math.floor((y + h + R) / TILE);
      for (var i = x0; i <= x1; i++)
      for (var j = y0; j <= y1; j++) {
        if (i >= 0 && j >= 0 && i < this.width && j < this.height) {
          var es = entityMap[i + j * this.width];
          for (var k = 0; k < es.length; k++) {
            var e = es.get(k);
            var xx0 = e.x;
            var yy0 = e.y;
            var xx1 = e.x + e.width;
            var yy1 = e.y + e.height;
            if (xx0 > x + w || yy0 > y + h || xx1 < x || yy1 < y) continue;

            hits.push(e);
          }
        }
      }
      return hits;
    };

    /*public void render(Graphics g, Camera camera) {
      establishCamera(camera);
      g.translate(-camera.x, -camera.y);

      int xo = camera.x / 10;
      int yo = camera.y / 10;
      for (int x = xo; x <= xo + camera.width / 10; x++) {
        for (int y = yo; y <= yo + camera.height / 10; y++) {
          if (x >= 0 && y >= 0 && x < width && y < height) {
            int ximg = 0;
            int yimg = 0;
            byte w = walls[x + y * width];
            if (w == 1) {
              g.setColor(Color.blue);
              g.fillRect(x * 10, y * 10, 10, 10);
            }
            //g.drawImage(Art.walls[ximg][yimg], x * 10, y * 10, null);
          }
        }
      }
      for (int i = entities.size() - 1; i >= 0; i--) {
        Entity e = entities.get(i);
        e.render(g, camera);
      }
    }*/

    this.isFree = function(e, x, y, dx, dy) {
      x += dx;
      y += dy;
      var d = 0.1;
      var x0 = Math.floor(x / TILE);
      var y0 = Math.floor(y / TILE);
      var x1 = Math.floor((x + e.width - d) / TILE);
      var y1 = Math.floor((y + e.height - d) / TILE);
      var ok = true;
      for (var i = x0; i <= x1; i++)
        for (var j = y0; j <= y1; j++) {
          if (i >= 0 && j >= 0 && i < this.width && j < this.height) {
            var wall = walls[x + y * width];
            if (wall != 0) ok = false;
            if (wall == 8) ok = true;
            if (wall == 6) {
              e.dx += 0.12;
            }
            if (wall == 7) {
              e.dx -= 0.12;
            }
          }
        }

      return ok;
    };

    this.addBlock = function(x, y, b) {
      if(x + y * this.width <= this.walls.length)
        this.walls[x + y * this.width] = b;
    };
  }

  // Entities
  function Entity() {
    this.onGround = false;

    this.x = 0;
    this.y = 0;
    this.dx = 0;
    this.dy = 0;

    this.bounce = 0.05;
    this.width = 10;
    this.height = 10;

    this.level = null;
    this.removed = false;
    this.xSlot = 0;
    this.ySlot = 0;

    this.setLevel = function(l) {this.level = l;};

    this.tryMove = function(dx, dy) {
      this.onGround = false;
      if (this.level.isFree(this, this.x, this.y, this.width, this.height, dx, 0)) {
        this.x += dx;
      } else {
        this.hitWall(dx, 0);
        var old = dx;
        if (dx < 0) {
          var sx = this.x / TILE;
          dx = -(sx - Math.floor(sx)) * TILE;
        } else {
          var sx = (this.x + this.width) / TILE;
          dx = TILE - (sx - Math.floor(sx)) * TILE;
        }
        if (level.isFree(this, this.x, this.y, this.width, this.height, dx, 0)) {
          this.x += dx;
        }
        this.dx = -this.bounce * old;
      }
      if (level.isFree(this, this.x, this.y, this.width, this.height, 0, dy)) {
        this.y += dy;
      } else {
        if (dy > 0) this.onGround = true;
        this.hitWall(0, dy);
        var old = dy;
        if (dy < 0) {
          var sy = this.y / TILE;
          dy = -(sy - Math.floor(sy)) * TILE;
        } else {
          var sy = (this.y + height) / TILE;
          dy = TILE - (sy - Math.floor(sy)) * TILE;
        }
        if (this.level.isFree(this, this.x, this.y, this.width, this.height, 0, dy)) {
          this.y += dy;
        }
        this.dy = -this.bounce * old;
      }
    };

    this.hitWall = function(dx, dy) {};

    this.remove = function() {this.removed = true;};

    this.tick = function() {};

    this.outOfBounds = function() {this.remove();};
}

  //-------------------------------------------------------------------------
  // UPDATE LOOP
  //-------------------------------------------------------------------------

  function onkey(ev, key, down) {
    switch(key) {
      case KEY.LEFT:  player.left  = down; ev.preventDefault(); return false;
      case KEY.RIGHT: player.right = down; ev.preventDefault(); return false;
      case KEY.SPACE: player.jump  = down; ev.preventDefault(); return false;
    }
  }
var deb = [100, 600];
  function onmouse(ev) {
    ev.preventDefault();
    switch(ev.button) {
      case 0:
        var cw = platformer.clientWidth;
        //alert(ev.offsetX + " " + ev.offsetY + " " + cw);

          var ch = platformer.clientHeight;
          var ex = ev.offsetX / cw * ctx.canvas.width;
          var ey = ev.offsetY / ch * ctx.canvas.height;

          var px = deb[0];//(player.x);
          var py = deb[1];//(player.y);

        var k = ((ey - py) / (ex - px));
          //alert(Math.atan(k) / Math.PI * 180);
        var bxa = Math.sqrt(1000000.0 / (1 + k*k)) * (ex - px > 0 ? 1 : -1);
        var bya = bxa * k;
        deb[2] = bxa;
        deb[3] = bya;
        bullets.push(setupEntity({
          "height":5,
          "name":"bullet",
          "properties": {gravity: 0, friction: 0},
          "type":"bullet",
          "visible":true,
          "width":5,
          "x":px,
          "y":py,
          "dx":bxa,
          "dy":bya
        }));
        return false;
    }
  }
  
  function update(dt) {
    updatePlayer(dt);
    updateMonsters(dt);
    updateBullets(dt);
    checkTreasure();
  }

  function updatePlayer(dt) {
    updateEntity(player, dt);
  }

  function updateMonsters(dt) {
    var n, max;
    for(n = 0, max = monsters.length ; n < max ; n++)
      updateMonster(monsters[n], dt);
  }

  function updateMonster(monster, dt) {
    if (!monster.dead) {
      updateEntity(monster, dt);
      if (overlap(player.x, player.y, TILE, TILE, monster.x, monster.y, TILE, TILE)) {
        if ((player.dy > 0) && (monster.y - player.y > TILE/2))
          killMonster(monster);
        else
          killPlayer(player);
      }

      var n, max;
      for(n = 0, max = bullets.length ; n < max ; n++) {
        var b = bullets[n];
        if (overlap(b.x, b.y, b.width, b.height, monster.x, monster.y, TILE, TILE)) {
          b.dead = true;
          monster.dead = true;
        }
      }
    }
  }

  function updateBullets(dt) {
    var n, max;
    for(n = 0, max = bullets.length ; n < max ; n++)
      updateBullet(bullets[n], dt);
  }

  function updateBullet(bullet, dt) {
    if (!bullet.dead) {
      updateEntity(bullet, dt);
    }
  }

  function checkTreasure() {
    var n, max, t;
    for(n = 0, max = treasure.length ; n < max ; n++) {
      t = treasure[n];
      if (!t.collected && overlap(player.x, player.y, TILE, TILE, t.x, t.y, TILE, TILE))
        collectTreasure(t);
    }
  }

  function killMonster(monster) {
    player.killed++;
    monster.dead = true;
  }

  function killPlayer(player) {
    player.x = player.start.x;
    player.y = player.start.y;
    player.dx = player.dy = 0;
  }

  function collectTreasure(t) {
    player.collected++;
    t.collected = true;
  }

  function updateEntity(entity, dt) {
    var wasleft    = entity.dx  < 0,
        wasright   = entity.dx  > 0,
        falling    = entity.falling,
        friction   = entity.friction * (falling ? 0.5 : 1),
        accel      = entity.accel    * (falling ? 0.5 : 1);
  
    entity.ddx = 0;
    entity.ddy = entity.gravity;
  
    if (entity.left)
      entity.ddx = entity.ddx - accel;
    else if (wasleft)
      entity.ddx = entity.ddx + friction;
  
    if (entity.right)
      entity.ddx = entity.ddx + accel;
    else if (wasright)
      entity.ddx = entity.ddx - friction;
  
    if (entity.jump && !entity.jumping && !falling) {
      entity.ddy = entity.ddy - entity.impulse; // an instant big force impulse
      entity.jumping = true;
    }
  
    entity.x  = entity.x  + (dt * entity.dx);
    entity.y  = entity.y  + (dt * entity.dy);
    entity.dx = bound(entity.dx + (dt * entity.ddx), -entity.maxdx, entity.maxdx);
    entity.dy = bound(entity.dy + (dt * entity.ddy), -entity.maxdy, entity.maxdy);
  
    if ((wasleft  && (entity.dx > 0)) ||
        (wasright && (entity.dx < 0))) {
      if(entity.friction != 0)
        entity.dx = 0; // clamp at zero to prevent friction from making us jiggle side to side
    }
  
    var tx        = p2t(entity.x),
        ty        = p2t(entity.y),
        nx        = entity.x%TILE,
        ny        = entity.y%TILE,
        cell      = tcell(tx,     ty),
        cellright = tcell(tx + 1, ty),
        celldown  = tcell(tx,     ty + 1),
        celldiag  = tcell(tx + 1, ty + 1);
  
    if (entity.dy > 0) {
      if ((celldown && !cell) ||
          (celldiag && !cellright && nx)) {
        entity.y = t2p(ty);
        entity.dy = 0;
        entity.falling = false;
        entity.jumping = false;
        ny = 0;
      }
    }
    else if (entity.dy < 0) {
      if ((cell      && !celldown) ||
          (cellright && !celldiag && nx)) {
        entity.y = t2p(ty + 1);
        entity.dy = 0;
        cell      = celldown;
        cellright = celldiag;
        ny        = 0;
      }
    }
  
    if (entity.dx > 0) {
      if ((cellright && !cell) ||
          (celldiag  && !celldown && ny)) {
        entity.x = t2p(tx);
        entity.dx = 0;
      }
    }
    else if (entity.dx < 0) {
      if ((cell     && !cellright) ||
          (celldown && !celldiag && ny)) {
        entity.x = t2p(tx + 1);
        entity.dx = 0;
      }
    }

    if (entity.monster) {
      if (entity.left && (cell || !celldown)) {
        entity.left = false;
        entity.right = true;
      }
      else if (entity.right && (cellright || !celldiag)) {
        entity.right = false;
        entity.left  = true;
      }
    }
  
    entity.falling = ! (celldown || (nx && celldiag));
  
  }

  //-------------------------------------------------------------------------
  // RENDERING
  //-------------------------------------------------------------------------
  
  function render(ctx, frame, dt) {
    ctx.clearRect(0, 0, width, height);
    renderMap(ctx);
    renderTreasure(ctx, frame);
    renderPlayer(ctx, dt);
    renderMonsters(ctx, dt);
    renderBullets(ctx, dt);
    ctx.fillStyle = "FFFFFF";
    ctx.fillRect(deb[0], deb[1], 2, 2);
    ctx.borderStyle = "FFFFFF";
    ctx.beginPath();
    ctx.moveTo(deb[0], deb[1]);
    ctx.lineTo(deb[2] * 70, deb[3] * 70);
    ctx.stroke();
  }

  function renderMap(ctx) {
    var x, y, cell;
    for(y = 0 ; y < MAP.th ; y++) {
      for(x = 0 ; x < MAP.tw ; x++) {
        cell = tcell(x, y);
        if (cell) {
          ctx.fillStyle = COLORS[cell - 1];
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
      }
    }
  }

  function renderPlayer(ctx, dt) {
    ctx.fillStyle = COLOR.YELLOW;
    ctx.fillRect(player.x + (player.dx * dt), player.y + (player.dy * dt), TILE, TILE);

    var n, max;

    ctx.fillStyle = COLOR.GOLD;
    for(n = 0, max = player.collected ; n < max ; n++)
      ctx.fillRect(t2p(2 + n), t2p(2), TILE/2, TILE/2);

    ctx.fillStyle = COLOR.SLATE;
    for(n = 0, max = player.killed ; n < max ; n++)
      ctx.fillRect(t2p(2 + n), t2p(3), TILE/2, TILE/2);
  }

  function renderMonsters(ctx, dt) {
    ctx.fillStyle = COLOR.SLATE;
    var n, max, monster;
    for(n = 0, max = monsters.length ; n < max ; n++) {
      monster = monsters[n];
      if (!monster.dead)
        ctx.fillRect(monster.x + (monster.dx * dt), monster.y + (monster.dy * dt), TILE, TILE);
    }
  }

  function renderTreasure(ctx, frame) {
    ctx.fillStyle   = COLOR.GOLD;
    ctx.globalAlpha = 0.25 + tweenTreasure(frame, 60);
    var n, max, t;
    for(n = 0, max = treasure.length ; n < max ; n++) {
      t = treasure[n];
      if (!t.collected)
        ctx.fillRect(t.x, t.y + TILE/3, TILE, TILE*2/3);
    }
    ctx.globalAlpha = 1;
  }

  function renderBullets(ctx) {
    var n, max, t;
    for(n = 0, max = bullets.length ; n < max ; n++) {
      var b = bullets[n];
      if (!b.dead) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(b.x, b.y, b.width, b.height);
        /*var x1 = Math.floor(b.x + TILE / 2 - b.dx * 3);
        var y1 = Math.floor(b.y + TILE / 2 - b.dy * 3);
        var x2 = Math.floor(b.x + TILE / 2);
        var y2 = Math.floor(b.y + TILE / 2);
        ctx.fillStyle = COLOR.YELLOW;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.fill();

        x1 = Math.floor(b.x + TILE / 2 - b.dx);
        y1 = Math.floor(b.y + TILE / 2 - b.dy);
        x2 = Math.floor(b.x + TILE / 2 + b.dx);
        y2 = Math.floor(b.y + TILE / 2 + b.dy);
        ctx.fillStyle = COLOR.WHITE;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.fill();*/
      }
    }
  }

  function tweenTreasure(frame, duration) {
    var half  = duration/ 2,
        pulse = frame%duration;
    return pulse < half ? (pulse/half) : 1-(pulse-half)/half;
  }

  //-------------------------------------------------------------------------
  // LOAD THE MAP
  //-------------------------------------------------------------------------
  
  function setup(map) {
    var data    = map.layers[0].data,
        objects = map.layers[1].objects,
        n, obj, entity;

    for(n = 0 ; n < objects.length ; n++) {
      obj = objects[n];
      entity = setupEntity(obj);
      switch(obj.type) {
      case "player"   : player = entity; break;
      case "monster"  : monsters.push(entity); break;
      case "treasure" : treasure.push(entity); break;
      }
    }

    cells = data;
  }

  function setupEntity(obj) {
    var entity = {};
    entity.x        = obj.x;
    entity.y        = obj.y;
    entity.dx       = obj.dx || 0;
    entity.dy       = obj.dy || 0;
    entity.gravity  = METER * (obj.properties.gravity || GRAVITY);
    entity.maxdx    = METER * (obj.properties.maxdx   || MAXDX);
    entity.maxdy    = METER * (obj.properties.maxdy   || MAXDY);
    entity.impulse  = METER * (obj.properties.impulse || IMPULSE);
    entity.accel    = entity.maxdx / (obj.properties.accel    || ACCEL);
    entity.friction = entity.maxdx / (obj.properties.friction || FRICTION);
    if(obj.type == "bullet")
      entity.friction = 0;
    if(obj.type == "bullet")
      entity.gravity = 0;
    entity.monster  = obj.type == "monster";
    entity.player   = obj.type == "player";
    entity.treasure = obj.type == "treasure";
    entity.bullet   = obj.type == "bullet";
    entity.left     = obj.properties.left;
    entity.right    = obj.properties.right;
    entity.start    = { x: obj.x, y: obj.y }
    entity.killed = entity.collected = 0;
    entity.width    = obj.width || TILE;
    entity.height   = obj.height || TILE;
    return entity;
  }

  //-------------------------------------------------------------------------
  // THE GAME LOOP
  //-------------------------------------------------------------------------
  
  var counter = 0, dt = 0, now,
      last = timestamp(),
      fpsmeter = new FPSMeter({ decimals: 0, graph: true, theme: 'dark', left: '5px' });
  
  function frame() {
    fpsmeter.tickStart();
    now = timestamp();
    dt = dt + Math.min(1, (now - last) / 1000);
    while(dt > step) {
      dt = dt - step;
      update(step);
    }
    render(ctx, counter, dt);
    last = now;
    counter++;
    fpsmeter.tick();
    requestAnimationFrame(frame, canvas);
  }
  
  document.addEventListener('keydown', function(ev) { return onkey(ev, ev.keyCode, true);  }, false);
  document.addEventListener('keyup',   function(ev) { return onkey(ev, ev.keyCode, false); }, false);
  canvas.addEventListener("mousedown", onmouse, false);

  get("level.json", function(req) {
    setup(JSON.parse(req.responseText));
  });
  frame();

})();

