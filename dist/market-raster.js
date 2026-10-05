// Display-only adaptation of the supplied XIAO rendering reference.
// A one-bit base keeps the bitmap text and grid crisp; colored candle fills
// are presented at the same integer coordinates, without interpolation.
const CANDLE_COLORS={up:'#7fe0be',down:'#ff909c'};
const FONT = {
 '0':['01110','10001','10011','10101','11001','10001','01110'],
 '1':['00100','01100','00100','00100','00100','00100','01110'],
 '2':['01110','10001','00001','00010','00100','01000','11111'],
 '3':['11110','00001','00001','01110','00001','00001','11110'],
 '4':['00010','00110','01010','10010','11111','00010','00010'],
 '5':['11111','10000','10000','11110','00001','00001','11110'],
 '6':['00110','01000','10000','11110','10001','10001','01110'],
 '7':['11111','00001','00010','00100','01000','01000','01000'],
 '8':['01110','10001','10001','01110','10001','10001','01110'],
 '9':['01110','10001','10001','01111','00001','00010','01100'],
 'A':['01110','10001','10001','11111','10001','10001','10001'],
 'B':['11110','10001','10001','11110','10001','10001','11110'],
 'C':['01111','10000','10000','10000','10000','10000','01111'],
 'D':['11110','10001','10001','10001','10001','10001','11110'],
 'E':['11111','10000','10000','11110','10000','10000','11111'],
 'F':['11111','10000','10000','11110','10000','10000','10000'],
 'G':['01111','10000','10000','10111','10001','10001','01111'],
 'H':['10001','10001','10001','11111','10001','10001','10001'],
 'I':['01110','00100','00100','00100','00100','00100','01110'],
 'J':['00111','00010','00010','00010','10010','10010','01100'],
 'K':['10001','10010','10100','11000','10100','10010','10001'],
 'L':['10000','10000','10000','10000','10000','10000','11111'],
 'M':['10001','11011','10101','10101','10001','10001','10001'],
 'N':['10001','11001','10101','10011','10001','10001','10001'],
 'O':['01110','10001','10001','10001','10001','10001','01110'],
 'P':['11110','10001','10001','11110','10000','10000','10000'],
 'Q':['01110','10001','10001','10001','10101','10010','01101'],
 'R':['11110','10001','10001','11110','10100','10010','10001'],
 'S':['01111','10000','10000','01110','00001','00001','11110'],
 'T':['11111','00100','00100','00100','00100','00100','00100'],
 'U':['10001','10001','10001','10001','10001','10001','01110'],
 'V':['10001','10001','10001','10001','10001','01010','00100'],
 'W':['10001','10001','10001','10101','10101','10101','01010'],
 'X':['10001','10001','01010','00100','01010','10001','10001'],
 'Y':['10001','10001','01010','00100','00100','00100','00100'],
 'Z':['11111','00001','00010','00100','01000','10000','11111'],
 '-':['00000','00000','00000','11111','00000','00000','00000'],
 '+':['00000','00100','00100','11111','00100','00100','00000'],
 '.':['00000','00000','00000','00000','00000','00110','00110'],
 ':':['00000','00110','00110','00000','00110','00110','00000'],
 '/':['00001','00001','00010','00100','01000','10000','10000'],
 '%':['11001','11010','00100','01000','10110','00110','00000'],
 ' ':['00000','00000','00000','00000','00000','00000','00000']
};

export class Raster {
 constructor(width,height){
  this.width=width;this.height=height;this.stride=Math.ceil(width/8);
  this.bits=new Uint8Array(this.stride*height).fill(255);
  this.colorRects=[];
 }
 pixel(x,y){
  x=Math.round(x);y=Math.round(y);
  if(x<0||y<0||x>=this.width||y>=this.height)return;
  this.bits[y*this.stride+(x>>3)]&=~(128>>(x&7));
 }
 line(x0,y0,x1,y1){
  x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
  const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;
  let error=dx+dy;
  for(;;){this.pixel(x0,y0);if(x0===x1&&y0===y1)break;const twice=2*error;if(twice>=dy){error+=dy;x0+=sx;}if(twice<=dx){error+=dx;y0+=sy;}}
 }
 rect(x,y,w,h,filled=false,color=null){
  x=Math.round(x);y=Math.round(y);w=Math.max(1,Math.round(w));h=Math.max(1,Math.round(h));
  if(filled&&color)this.colorRects.push({x,y,w,h,color});
  if(filled){for(let row=y;row<y+h;row++)this.line(x,row,x+w-1,row);return;}
  this.line(x,y,x+w-1,y);this.line(x,y+h-1,x+w-1,y+h-1);
  this.line(x,y,x,y+h-1);this.line(x+w-1,y,x+w-1,y+h-1);
 }
 text(value,x,y,scale=1,spacing=scale){
  for(const char of String(value).toUpperCase()){
   const glyph=FONT[char]??FONT[' '];
   glyph.forEach((row,yy)=>{for(let xx=0;xx<5;xx++)if(row[xx]==='1')for(let sy=0;sy<scale;sy++)for(let sx=0;sx<scale;sx++)this.pixel(x+xx*scale+sx,y+yy*scale+sy);});
   x+=5*scale+spacing;
  }
 }
 present(canvas){
  if(canvas.width!==this.width)canvas.width=this.width;
  if(canvas.height!==this.height)canvas.height=this.height;
  const context=canvas.getContext('2d'),frame=context.createImageData(this.width,this.height);
  for(let y=0;y<this.height;y++)for(let x=0;x<this.width;x++){
   const v=this.bits[y*this.stride+(x>>3)]&(128>>(x&7))?255:0,i=(y*this.width+x)*4;
   frame.data[i]=frame.data[i+1]=frame.data[i+2]=v;frame.data[i+3]=255;
  }
  context.imageSmoothingEnabled=false;context.putImageData(frame,0,0);
  for(const {x,y,w,h,color} of this.colorRects){context.fillStyle=color;context.fillRect(x,y,w,h);}
 }
 // Export an actual 1bit grayscale PNG, independently of Canvas's RGBA encoder.
 png(){
  const be=n=>Uint8Array.of(n>>>24,n>>>16&255,n>>>8&255,n&255);
  const join=(...parts)=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
  const crc=data=>{let c=0xffffffff;for(const b of data){c^=b;for(let i=0;i<8;i++)c=c&1?(c>>>1)^0xedb88320:c>>>1;}return(c^0xffffffff)>>>0;};
  const chunk=(type,data)=>{const payload=join(new TextEncoder().encode(type),data);return join(be(data.length),payload,be(crc(payload)));};
  const scan=new Uint8Array((this.stride+1)*this.height);
  for(let y=0;y<this.height;y++)scan.set(this.bits.subarray(y*this.stride,(y+1)*this.stride),y*(this.stride+1)+1);
  let a=1,b=0;for(const value of scan){a=(a+value)%65521;b=(b+a)%65521;}
  const blocks=[];
  for(let start=0;start<scan.length;start+=65535){const part=scan.subarray(start,start+65535),n=part.length;blocks.push(Uint8Array.of(start+n===scan.length?1:0,n&255,n>>>8,(~n)&255,((~n)>>>8)&255),part);}
  const header=join(be(this.width),be(this.height),Uint8Array.of(1,0,0,0,0));
  return join(Uint8Array.of(137,80,78,71,13,10,26,10),chunk('IHDR',header),chunk('IDAT',join(Uint8Array.of(0x78,0x01),...blocks,be((b<<16|a)>>>0))),chunk('IEND',new Uint8Array()));
 }
}

export function drawTrend(model,width,{progress=1,moving=false}={}){
 const height=width<480?164:204,r=new Raster(width,height);
 const wide=width>=480;
 const axisScale=wide?3:2,roundScale=wide?2:1,gapScale=wide?2:1,statsScale=wide?2:1;
 const textWidth=(value,scale=1,spacing=scale)=>String(value).length*(5*scale+spacing)-spacing;
 const labels=[];
 const text=(value,x,y,scale=1,spacing=scale,role='')=>{
  x=Math.round(x);y=Math.round(y);r.text(value,x,y,scale,spacing);
  labels.push({value:String(value),x,y,width:textWidth(value,scale,spacing),height:7*scale,scale,role});
 };
 // Align all three header rows with the plot's left axis, as in the reference.
 // Fit the heading beside the round number without changing the image size.
 const radius=Math.max(100-model.scale.min,model.scale.max-100);
 const step=Math.max(2,Math.ceil(radius/4)*2);
 const low=100-2*step,high=100+2*step;
 // Give the longest axis label just 2px at the image edge, leaving an 8px
 // gap to the plot. Size from the reserved domain, never animation progress.
 const axisLabelWidth=Math.max(...Array.from({length:5},(_,i)=>textWidth(String(high-i*step),axisScale)));
 const left=2+axisLabelWidth+8,right=width-12,roundTitle=`R${String(model.round).padStart(2,'0')}`;
 const titleScale=[wide?4:3,2].find(scale=>textWidth('ROUND TREND',scale,1)+textWidth(roundTitle,scale,1)+4<=right-left);
 const subtitleY=6+7*titleScale+3,statsY=subtitleY+7*statsScale+3;
 const gapY=statsY+7*statsScale+3,top=gapY+7*gapScale+4,bottom=height-(wide?25:22);
 // Keep four dotted sections; each contains one, two, then three round slots.
 const slots=Math.max(4,Math.ceil(model.round/4)*4),cell=(right-left)/slots;
 const x=round=>Math.round(left+cell*(round-.5));
 // Reserve the same stage-dependent domain as the existing display. Do not
 // derive the scale from a partially animated result or change past candles.
 // Center 100 between two intervals on either side, including reserved moves.
 // Five evenly spaced ticks start at 2 points and widen by even multiples.
 const y=value=>Math.round(bottom-(value-low)*(bottom-top)/(high-low));
 const known=moving||!model.current?model.history:[...model.history,model.current];
 const values=[100,...known.flatMap(c=>[c.open,c.close])];
 const last=known.at(-1)?.close??100;
 const stats={min:Math.min(...values),max:Math.max(...values),last};
 text('ROUND TREND',left,6,titleScale,1,'title');
 text(roundTitle,right-textWidth(roundTitle,titleScale,1),6,titleScale,1,'current-round');
 text('MARKET INDEX / START 100',left,subtitleY,statsScale,1,'subtitle');
 const columns=[['MIN',stats.min],['MAX',stats.max],['LAST',stats.last]].map(([name,value])=>`${name} ${value.toFixed(2)}`);
 const columnWidth=(right-left)/3;
 // Match the subtitle's size and keep MIN/MAX/LAST on one row. At the
 // narrowest sizes, compact bitmap spacing also accommodates large indices.
 const statsSpacing=columns.every(value=>textWidth(value,statsScale,1)<=columnWidth)?1:0;
 columns.forEach((value,i)=>text(value,left+i*columnWidth,statsY,statsScale,statsSpacing,'stats'));
 const ticks=[];
 for(let i=0;i<=(high-low)/step;i++){
  const value=high-i*step,yy=y(value);
  const label=String(value);
  text(label,left-8-textWidth(label,axisScale),yy-Math.floor(7*axisScale/2),axisScale,axisScale,'tick');
  ticks.push({value,y:yy,label});
  for(let xx=left;xx<=right;xx+=4)r.pixel(xx,yy);
 }
 for(let i=0;i<=4;i++){const xx=Math.round(left+(right-left)*i/4);for(let yy=top;yy<=bottom;yy+=4)r.pixel(xx,yy);}
 r.line(left,top,left,bottom);r.line(left,bottom,right,bottom);
 const glyphWidth=5,barWidth=Math.max(3,Math.min(14,Math.floor(cell*.4)));
 const historicalLabelWidth=textWidth('01',roundScale),currentLabelWidth=textWidth('R01',roundScale);
 const stride=Math.ceil(slots*(historicalLabelWidth+3)/(right-left));
 const currentLabelGap=(historicalLabelWidth+currentLabelWidth)/2+3;
 const roundLabel=(label,xx)=>text(label,xx-Math.floor(textWidth(label,roundScale)/2),bottom+7,roundScale,roundScale,'round');
 const bodies=[];
 const candle=(c,active=false)=>{
  const close=active?c.open+(c.close-c.open)*progress:c.close;
  const openY=y(c.open),closeY=y(close),xx=x(c.round);
  const bodyX=xx-Math.floor(barWidth/2),bodyY=Math.min(openY,closeY),bodyHeight=Math.abs(closeY-openY)+1;
  // Frame outside the body so even a one-pixel move keeps its direction color.
  r.rect(bodyX-1,bodyY-1,barWidth+2,bodyHeight+2);
  r.rect(bodyX,bodyY,barWidth,bodyHeight,true,CANDLE_COLORS[c.direction]);
  if(c.gap&&!(active&&moving))text('G',xx-Math.floor(textWidth('G',gapScale)/2),gapY,gapScale,gapScale,'gap');
  if(active||((c.round-1)%stride===0&&x(model.round)-xx>=currentLabelGap))roundLabel(`${active?'R':''}${String(c.round).padStart(2,'0')}`,xx);
  bodies.push({round:c.round,x:xx,openY,closeY,open:c.open,close:c.close,displayClose:close,active});
 };
 for(const c of model.history)candle(c);
 if(model.current)candle(model.current,true);
 else {const xx=x(model.round),yy=y(model.open);r.line(xx-3,yy,xx+3,yy);roundLabel(roundTitle,xx);}
 // One existing current round, no invented high/low wicks or extra samples.
 return {raster:r,stats,low,high,step,ticks,bodies,labels,plot:{left,right,top,bottom},barWidth,glyphWidth};
}
