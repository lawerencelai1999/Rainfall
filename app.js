(function(){
"use strict";
const periodLabels={Now:"目前",Past10Min:"過去 10 分鐘",Past1hr:"過去 1 小時",Past3hr:"過去 3 小時",Past6hr:"過去 6 小時",Past12hr:"過去 12 小時",Past24hr:"過去 24 小時",Past2days:"過去 2 天",Past3days:"過去 3 天"};
const $=s=>document.querySelector(s);
const fmt=d3.format(".1f"), intFmt=d3.format(",");
let data=[],period="Past24hr",county="全部",selectedId=null,brushRange=null;
const margin={top:12,right:22,bottom:34,left:42};
const tooltip=d3.select("#tooltip");
const dims={map:{w:680,h:310},county:{w:480,h:340},hist:{w:680,h:165}};
function showTip(html,event){tooltip.html(html).classed("show",true);moveTip(event)}
function moveTip(event){tooltip.style("left",(event.clientX+14)+"px").style("top",(event.clientY+14)+"px")}
function hideTip(){tooltip.classed("show",false)}
function val(d){return d[period]}
function countyBase(){return data.filter(d=>county==="全部"||d.county===county)}
function visible(){let a=countyBase();if(brushRange)a=a.filter(d=>val(d)>=brushRange[0]&&val(d)<=brushRange[1]);return a}
function setupSelect(){
 const counties=Array.from(new Set(data.map(d=>d.county))).sort(d3.ascending);
 d3.select("#countySelect").selectAll("option.county").data(counties).join("option").attr("class","county").attr("value",d=>d).text(d=>d);
}
function updateKpis(rows){
 const vals=rows.map(val).filter(Number.isFinite),mean=d3.mean(vals)||0,max=d3.greatest(rows,d=>val(d)),wet=rows.filter(d=>val(d)>0).length;
 $("#stationCount").textContent=intFmt(rows.length);
 $("#meanRain").textContent=fmt(mean);
 $("#maxRain").textContent=max?fmt(val(max))+" mm":"—";
 $("#maxStation").textContent=max?max.station_name+" · "+max.county:"沒有資料";
 $("#wetCount").textContent=intFmt(wet);
 $("#wetRate").textContent=(rows.length?(wet/rows.length*100):0).toFixed(1)+"% 測站有降雨";
}
function makeSvg(id,w,h){return d3.select(id).attr("viewBox",`0 0 ${w} ${h}`).attr("preserveAspectRatio","xMidYMid meet")}
function drawMap(rows){
 const {w,h}=dims.map,svg=makeSvg("#mapChart",w,h);svg.selectAll("*").remove();
 const x=d3.scaleLinear().domain([119.2,122.2]).range([55,w-38]),y=d3.scaleLinear().domain([21.7,25.6]).range([h-22,18]);
 // A light geographic frame, deliberately not a political boundary map.
 svg.append("rect").attr("x",x(119.2)).attr("y",y(25.6)).attr("width",x(122.2)-x(119.2)).attr("height",y(21.7)-y(25.6)).attr("rx",12).attr("fill","#0d1b29").attr("stroke","#263c50");
 [120,121,122].forEach(lon=>svg.append("line").attr("x1",x(lon)).attr("x2",x(lon)).attr("y1",18).attr("y2",h-22).attr("stroke","#203448").attr("stroke-dasharray","3 5"));
 [22,23,24,25].forEach(lat=>svg.append("line").attr("x1",55).attr("x2",w-38).attr("y1",y(lat)).attr("y2",y(lat)).attr("stroke","#203448").attr("stroke-dasharray","3 5"));
 svg.append("text").attr("x",w-40).attr("y",h-5).attr("text-anchor","end").attr("fill","#70899d").attr("font-size",9).text("經度 →");
 svg.append("text").attr("x",8).attr("y",16).attr("fill","#70899d").attr("font-size",9).text("緯度");
 const max=d3.max(countyBase(),val)||1,r=d3.scaleSqrt().domain([0,max]).range([2.2,12]);
 svg.append("g").selectAll("circle").data(rows,d=>d.station_id).join("circle")
  .attr("class",d=>"station-dot"+(d.station_id===selectedId?" selected":""))
  .attr("cx",d=>x(d.longitude)).attr("cy",d=>y(d.latitude)).attr("r",d=>d3.max([2.2,r(val(d))]))
  .attr("fill",d=>val(d)===0?"#4d8397":d3.interpolateYlOrRd(Math.min(.95,val(d)/max)))
  .attr("tabindex",0).attr("role","button").attr("aria-label",d=>`${d.county}${d.town}，${d.station_name}，${periodLabels[period]}降雨 ${fmt(val(d))} 毫米`)
  .on("mouseenter",(event,d)=>showTip(`<b>${d.station_name}</b><br>${d.county}・${d.town}<br>${periodLabels[period]}：${fmt(val(d))} mm`,event))
  .on("mousemove",moveTip).on("mouseleave",hideTip)
  .on("click",(event,d)=>selectStation(d)).on("keydown",(event,d)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();selectStation(d)}});
}
function drawCounty(rows){
 const {w,h}=dims.county,svg=makeSvg("#countyChart",w,h);svg.selectAll("*").remove();
 const grouped=Array.from(d3.rollup(rows,v=>({mean:d3.mean(v,val)||0,count:v.length}),d=>d.county),([name,v])=>({name,...v})).sort((a,b)=>d3.descending(a.mean,b.mean));
 const top=grouped.slice(0,22),left=74,right=42,topY=8,bottom=12;
 const x=d3.scaleLinear().domain([0,(d3.max(top,d=>d.mean)||1)*1.15]).nice().range([left,w-right]);
 const y=d3.scaleBand().domain(top.map(d=>d.name)).range([topY,h-bottom]).padding(.22);
 const g=svg.append("g");
 g.selectAll("line.grid").data(x.ticks(4)).join("line").attr("x1",d=>x(d)).attr("x2",d=>x(d)).attr("y1",topY).attr("y2",h-bottom).attr("stroke","#263b4e").attr("stroke-dasharray","2 4");
 g.selectAll("text.county-label").data(top).join("text").attr("class","county-label").attr("x",left-8).attr("y",d=>y(d.name)+y.bandwidth()/2+3).attr("text-anchor","end").text(d=>d.name);
 g.selectAll("rect.county-bar").data(top).join("rect").attr("class","county-bar").attr("x",left).attr("y",d=>y(d.name)).attr("height",y.bandwidth()).attr("width",d=>x(d.mean)-left).attr("rx",3)
 .on("click",(event,d)=>{county=d.name;$("#countySelect").value=county;brushRange=null;render()})
 .on("mouseenter",(event,d)=>showTip(`<b>${d.name}</b><br>平均：${fmt(d.mean)} mm<br>測站數：${d.count} 個`,event)).on("mousemove",moveTip).on("mouseleave",hideTip);
 g.selectAll("text.county-value").data(top).join("text").attr("class","county-value").attr("x",d=>x(d.mean)+5).attr("y",d=>y(d.name)+y.bandwidth()/2+3).text(d=>fmt(d.mean));
}
function drawHist(){
 const rows=countyBase(),{w,h}=dims.hist,svg=makeSvg("#histChart",w,h);svg.selectAll("*").remove();
 const left=42,right=18,top=8,bottom=30,vals=rows.map(val).filter(Number.isFinite),max=d3.max(vals)||1;
 const x=d3.scaleLinear().domain([0,max||1]).nice().range([left,w-right]);
 const bins=d3.bin().domain(x.domain()).thresholds(Math.min(22,Math.max(5,Math.ceil(Math.sqrt(vals.length)))))(vals);
 const y=d3.scaleLinear().domain([0,d3.max(bins,d=>d.length)||1]).nice().range([h-bottom,top]);
 svg.append("g").attr("class","grid").call(d3.axisLeft(y).ticks(3).tickSize(-(w-left-right)).tickFormat(""));
 svg.append("g").selectAll("rect").data(bins).join("rect").attr("class","hist-bar").attr("x",d=>x(d.x0)+1).attr("y",d=>y(d.length)).attr("width",d=>Math.max(0,x(d.x1)-x(d.x0)-2)).attr("height",d=>h-bottom-y(d.length));
 svg.append("g").attr("class","axis").attr("transform",`translate(0,${h-bottom})`).call(d3.axisBottom(x).ticks(6));
 svg.append("g").attr("class","axis").attr("transform",`translate(${left},0)`).call(d3.axisLeft(y).ticks(3));
 svg.append("text").attr("x",w-right).attr("y",h-3).attr("text-anchor","end").attr("fill","#91a5b8").attr("font-size",9).text("降雨量（mm）");
 const brush=d3.brushX().extent([[left,top],[w-right,h-bottom]]).on("end",event=>{
   if(!event.selection){brushRange=null;}else{const a=event.selection.map(x.invert).sort(d3.ascending);brushRange=a;}
   render(false);
 });
 const bg=svg.append("g").attr("class","brush").call(brush);
 if(brushRange)bg.call(brush.move,brushRange.map(x));
 $("#brushReadout").textContent=brushRange?`已選取：${fmt(brushRange[0])} – ${fmt(brushRange[1])} mm`:"目前未限制降雨量範圍";
}
function selectStation(d){
 selectedId=d.station_id;
 $("#stationDetail").innerHTML=`<div class="detail-name">${d.station_name}</div><div class="detail-id">${d.station_id} · ${d.maintainer}</div><div class="detail-grid">
 <div class="detail-cell"><span>縣市／鄉鎮</span><strong>${d.county} ${d.town}</strong></div>
 <div class="detail-cell"><span>${periodLabels[period]}降雨量</span><strong>${fmt(val(d))} mm</strong></div>
 <div class="detail-cell"><span>海拔高度</span><strong>${fmt(d.altitude)} m</strong></div>
 <div class="detail-cell"><span>座標（WGS84）</span><strong>${fmt(d.latitude)}, ${fmt(d.longitude)}</strong></div></div>`;
 drawMap(visible());
}
function render(rebuildHist=true){
 const rows=visible();updateKpis(rows);drawMap(rows);drawCounty(rows);if(rebuildHist)drawHist();
 if(selectedId&&!rows.some(d=>d.station_id===selectedId)){selectedId=null;$("#stationDetail").textContent="目前篩選條件不包含先前選取的測站。"}
}
function init(rows){
 data=rows.map(d=>{const o={...d};["latitude","longitude","altitude",...Object.keys(periodLabels)].forEach(k=>o[k]=+o[k]);return o})
 .filter(d=>Number.isFinite(d.latitude)&&Number.isFinite(d.longitude));
 const times=Array.from(new Set(data.map(d=>d.datetime)));$("#obsTime").textContent=times[0]||"觀測時間未提供";
 setupSelect();$("#periodSelect").addEventListener("change",e=>{period=e.target.value;selectedId=null;$("#stationDetail").textContent="選取地圖上的測站，即可查看詳細觀測資訊。";brushRange=null;render()});
 $("#countySelect").addEventListener("change",e=>{county=e.target.value;brushRange=null;selectedId=null;render()});
 $("#resetBtn").addEventListener("click",()=>{county="全部";period="Past24hr";brushRange=null;selectedId=null;$("#countySelect").value=county;$("#periodSelect").value=period;$("#stationDetail").textContent="選取地圖上的測站，即可查看詳細觀測資訊。";render()});
 $("#clearBrush").addEventListener("click",()=>{brushRange=null;render()});
 render();
}
d3.csv("data/rainfall_stations.csv",d3.autoType).then(init).catch(err=>{console.error(err);document.querySelector(".shell").insertAdjacentHTML("beforeend",'<p style="color:#ff9b86">資料載入失敗，請確認以本機伺服器開啟 index.html，且 data/rainfall_stations.csv 路徑正確。</p>')});
})();