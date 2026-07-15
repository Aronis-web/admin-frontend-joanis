/**
 * HTML self-contained para el WebView oculto que rasteriza el ticket Leeka
 * en Android/iOS. Replica `eslRender.ts` + `code128.ts` + `cleanProductTitle.ts`
 * porque un WebView no tiene acceso a los módulos del bundle RN.
 *
 * Protocolo de mensajes:
 *   RN → WV : { type: 'render', id, data }
 *   WV → RN : { type: 'rendered', id, base64 }   (bitmap 10_000 bytes)
 *   WV → RN : { type: 'error', id, message }
 *   WV → RN : { type: 'ready' }                  (al cargar)
 */

export const ESL_RENDER_HTML = `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>html,body{margin:0;padding:0;background:#fff;}canvas{display:block}</style>
</head>
<body>
<canvas id="c" width="200" height="200"></canvas>
<script>
(function(){
  var W = 200, H = 200, FRAME_BYTES = 10000;
  var COLORS = { K:'#000000', W:'#ffffff', Y:'#d9b300', R:'#c40000' };
  var PALETTE = [
    { c:'K', rgb:[0,0,0] },
    { c:'W', rgb:[255,255,255] },
    { c:'Y', rgb:[220,180,0] },
    { c:'R', rgb:[200,0,0] }
  ];
  var COLOR2BPP = { K:0, W:1, Y:2, R:3 };

  function nearest(r,g,b){
    var best='W', bd=Infinity;
    for (var i=0;i<PALETTE.length;i++){
      var p=PALETTE[i].rgb;
      var dr=r-p[0], dg=g-p[1], db=b-p[2];
      var d=dr*dr+dg*dg+db*db;
      if(d<bd){bd=d; best=PALETTE[i].c;}
    }
    return best;
  }

  function stripDiacritics(s){return s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');}
  var PACK_SUFFIX=/\\s*[xX*×]\\s*\\d{1,3}\\s*(pack|paquete|paq|caja|cj|bolsa)?\\s*$/i;
  var TRAIL_CODE=/\\s*[-_/]?\\s*\\d{5,}\\s*$/;
  var PAREN_TAIL=/\\s*\\([^)]*\\)\\s*$/;
  function cleanTitle(raw){
    if(!raw) return '';
    var t=String(raw).trim();
    for(var i=0;i<3;i++){
      var b=t;
      t=t.replace(PAREN_TAIL,'').replace(PACK_SUFFIX,'').replace(TRAIL_CODE,'').trim();
      if(t===b) break;
    }
    return stripDiacritics(t).toUpperCase();
  }

  // ---- Code128 ----
  var PATTERNS = [
    '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
    '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
    '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
    '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
    '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
    '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
    '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
    '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
    '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
    '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
    '114131','311141','411131','211412','211214','211232','2331112'
  ];
  function encode128(text){
    var allDigits=/^\\d+$/.test(text);
    var useC=allDigits && text.length>=4 && text.length%2===0;
    var codes=[];
    if(useC){
      codes.push(105);
      for(var i=0;i<text.length;i+=2) codes.push(parseInt(text.substr(i,2),10));
    } else {
      codes.push(104);
      for(var j=0;j<text.length;j++){
        var c=text.charCodeAt(j);
        if(c<32||c>126) throw new Error('Code128B char '+text[j]);
        codes.push(c-32);
      }
    }
    var sum=codes[0];
    for(var k=1;k<codes.length;k++) sum+=codes[k]*k;
    codes.push(sum%103);
    codes.push(106);
    var bars=[], total=0;
    for(var m=0;m<codes.length;m++){
      var p=PATTERNS[codes[m]];
      for(var n=0;n<p.length;n++){var w=parseInt(p[n],10); bars.push(w); total+=w;}
    }
    return { bars: bars, total: total };
  }
  function drawCode128(ctx,text,x,y,width,height,quiet){
    quiet = quiet||6;
    var enc=encode128(text);
    var totalMods=enc.total + quiet*2;
    var mw = width/totalMods;
    var cx = x + quiet*mw;
    var isBar=true;
    ctx.fillStyle='#000000';
    for(var i=0;i<enc.bars.length;i++){
      var w=enc.bars[i];
      var px=w*mw;
      if(isBar) ctx.fillRect(Math.round(cx), y, Math.ceil(px), height);
      cx+=px;
      isBar=!isBar;
    }
  }

  // ---- Wrap helpers ----
  function wrap(ctx,text,maxW,maxLines){
    var words=text.split(/\\s+/);
    var lines=[], cur='';
    for(var i=0;i<words.length;i++){
      var w=words[i];
      var cand=cur?cur+' '+w:w;
      if(ctx.measureText(cand).width<=maxW){cur=cand;}
      else{ if(cur) lines.push(cur); cur=w; if(lines.length>=maxLines) break; }
    }
    if(cur && lines.length<maxLines) lines.push(cur);
    if(lines.length>maxLines) lines.length=maxLines;
    if(lines.length===maxLines){
      var last=lines[maxLines-1];
      while(ctx.measureText(last+'…').width>maxW && last.length>0) last=last.slice(0,-1);
      var full=lines.join(' ');
      if(full.length<text.length) lines[maxLines-1]=last+'…';
    }
    return lines;
  }
  function drawTitle(ctx,text,x,y,maxW,maxH,start,minF){
    var fs=start, lines=[];
    while(fs>=minF){
      ctx.font='bold '+fs+'px sans-serif';
      lines=wrap(ctx,text,maxW,2);
      var lh=fs+2;
      if(lines.length*lh<=maxH) break;
      fs-=1;
    }
    var lh=fs+2, total=lines.length*lh;
    var cy=y+(maxH-total)/2+lh/2;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    for(var i=0;i<lines.length;i++){ ctx.fillText(lines[i], x+maxW/2, cy); cy+=lh; }
  }

  // ---- Render principal ----
  function drawTicket(d){
    var canvas=document.getElementById('c');
    var ctx=canvas.getContext('2d');
    ctx.fillStyle=COLORS.W; ctx.fillRect(0,0,W,H);

    var title=cleanTitle(d.title)||d.title||'—';
    var price = +d.price || 0;
    var orig = (d.originalPrice!=null && d.originalPrice>price)
      ? d.originalPrice
      : (function(){ var f=1.18+Math.random()*0.18; var raw=price*f; var fl=Math.floor(raw); var ch=Math.random()<0.6?0.9:0.5; return fl+ch; })();
    var discount=Math.max(0, Math.round((1 - price/orig)*100));
    var banner=d.bannerText || ('OFERTA -'+discount+'%');

    var bH=26;
    ctx.fillStyle=COLORS.R; ctx.fillRect(0,0,W,bH);
    ctx.fillStyle=COLORS.W; ctx.font='bold 14px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(banner.toUpperCase(), W/2, bH/2);

    var titleTop=bH+6, titleH=50;
    ctx.fillStyle=COLORS.K;
    drawTitle(ctx,title,4,titleTop,W-8,titleH,22,18);

    var sectY=titleTop+titleH;
    if(d.sku){
      ctx.fillStyle=COLORS.K; ctx.font='12px sans-serif';
      ctx.textBaseline='middle'; ctx.textAlign='center';
      ctx.fillText('SKU: '+String(d.sku).toUpperCase(), W/2, sectY+8);
      sectY+=18;
    }

    var origY=sectY+12, origText='S/ '+orig.toFixed(2);
    ctx.font='bold 14px sans-serif';
    var ow=ctx.measureText(origText).width+12;
    var ox=(W-ow)/2;
    ctx.fillStyle=COLORS.Y; ctx.fillRect(ox, origY-10, ow, 20);
    ctx.fillStyle=COLORS.K; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(origText, W/2, origY);
    ctx.strokeStyle=COLORS.R; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(ox+4,origY); ctx.lineTo(ox+ow-4,origY); ctx.stroke();

    var pY=origY+30;
    ctx.fillStyle=COLORS.R; ctx.textBaseline='middle'; ctx.textAlign='center';
    var pText=price.toFixed(2);
    ctx.font='bold 18px sans-serif';
    var cw=ctx.measureText('S/').width;
    ctx.font='bold 42px sans-serif';
    var pw=ctx.measureText(pText).width;
    var tw=cw+6+pw;
    var sx=(W-tw)/2;
    ctx.font='bold 18px sans-serif'; ctx.textAlign='left';
    ctx.fillText('S/', sx, pY);
    ctx.font='bold 42px sans-serif';
    ctx.fillText(pText, sx+cw+6, pY);

    var bAreaTop=H-30, bAreaH=26;
    ctx.fillStyle=COLORS.W; ctx.fillRect(0,bAreaTop,W,bAreaH);
    try { drawCode128(ctx, d.tagCode, 0, bAreaTop, W, bAreaH, 6); }
    catch(e){
      ctx.fillStyle=COLORS.K; ctx.font='12px monospace';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(String(d.tagCode), W/2, bAreaTop+bAreaH/2);
    }
    return canvas;
  }

  // ---- Canvas → bitmap nativo (rotación 90° CW + 2bpp MSB-first) ----
  function quantize(canvas){
    var ctx=canvas.getContext('2d');
    var img=ctx.getImageData(0,0,W,H);
    var px=img.data;
    var out=new Uint8Array(FRAME_BYTES);
    var bitIdx=0;
    for(var yD=0;yD<H;yD++){
      for(var xD=0;xD<W;xD++){
        var xL=W-1-yD, yL=xD;
        var idx=(yL*W+xL)*4;
        var col=nearest(px[idx],px[idx+1],px[idx+2]);
        var v=COLOR2BPP[col] & 3;
        var bi=bitIdx>>2;
        var pInB=bitIdx & 3;
        var sh=6 - pInB*2;
        out[bi] |= v<<sh;
        bitIdx++;
      }
    }
    return out;
  }

  function bytesToBase64(b){
    var s='';
    for(var i=0;i<b.length;i++) s+=String.fromCharCode(b[i]);
    return btoa(s);
  }

  function handleMessage(raw){
    var msg; try{ msg=JSON.parse(raw); } catch(e){ return; }
    if(msg.type==='render'){
      try {
        var canvas=drawTicket(msg.data);
        var bytes=quantize(canvas);
        post({ type:'rendered', id: msg.id, base64: bytesToBase64(bytes) });
      } catch(err){
        post({ type:'error', id: msg.id, message: String(err && err.message || err) });
      }
    }
  }
  function post(obj){
    var s=JSON.stringify(obj);
    if(window.ReactNativeWebView && window.ReactNativeWebView.postMessage){
      window.ReactNativeWebView.postMessage(s);
    }
  }

  // Bridges para Android (document) y iOS (window).
  document.addEventListener('message', function(ev){ handleMessage(ev.data); });
  window.addEventListener('message', function(ev){ handleMessage(ev.data); });
  post({ type:'ready' });
})();
</script>
</body></html>`;
