import {money} from './engine.js';
import {CPU_PROFILES} from './solo.js';

const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tone=value=>BigInt(value)>0n?'positive':BigInt(value)<0n?'negative':'';
const signed=value=>`${BigInt(value)>0n?'＋':''}${money(value)}`;

export function cpuPreviousQuote(career){
 const finish={steady:'次も、自分のペースで。',rival:'次の順位はどうなるかな。',gambler:'次の勝負だ。'}[career.id];
 if(!finish)return '';
 const last=career.latest;if(!last)return `はじめての対戦。${finish}`;
 let fact;
 if(last.status==='debt')fact='前回はギャップで負債退場。';
 else if(['cut','empty'].includes(last.status))fact='前回は資金が尽きて退場。';
 else if(last.won)fact=`前回は${money(last.wealth)}で${last.tied?'同率優勝':'優勝'}。`;
 else if(BigInt(last.wealth)<BigInt(last.initial))fact='前回は元本割れで終了。';
 else if(BigInt(last.wealth)===BigInt(last.initial))fact='前回は元本を残して終了。';
 else fact=`前回は${money(last.wealth)}を残して終了。`;
 return fact+finish;
}

export function cpuCareersView(careers){
 if(!Array.isArray(careers))return '';
 return `<section class="surface stats-surface cpu-career-surface"><details class="cpu-careers"><summary>CPUの戦績</summary><p class="stats-definition">あなたの保存済み試合に登場したCPUを、人格ごとに集計。同率優勝も1回として数えます。</p><div class="cpu-career-grid">${careers.filter(c=>Object.hasOwn(CPU_PROFILES,c.id)).map(c=>`<article class="cpu-career" data-cpu-career="${c.id}"><h3>${CPU_PROFILES[c.id].name}</h3><dl class="stats-metrics"><div><dt>対戦数</dt><dd data-cpu-stat="plays">${c.plays.toLocaleString('ja-JP')}回</dd></div><div><dt>優勝</dt><dd data-cpu-stat="wins">${c.wins.toLocaleString('ja-JP')}回</dd></div><div><dt>負債退場</dt><dd data-cpu-stat="debtExits">${c.debtExits.toLocaleString('ja-JP')}回</dd></div><div><dt>最高最終資産</dt><dd class="${c.highestFinal===null?'':tone(c.highestFinal)}" data-cpu-stat="highestFinal">${c.highestFinal===null?'—':money(c.highestFinal)}</dd></div><div class="cpu-career-total"><dt>累計損益</dt><dd class="${tone(c.pnlTotal)}" data-cpu-stat="pnlTotal">${c.plays?signed(c.pnlTotal):'—'}</dd></div></dl></article>`).join('')}</div></details></section>`;
}

export function personalBestsView(data){
 if(!data?.events?.length)return '';
 return `<section class="personal-bests" aria-label="あなたの自己記録">${data.events.slice(0,2).map(e=>`<div class="personal-best" data-personal-best="${escape(e.key)}"><div><span>${e.first?'初記録':'自己ベスト更新'}</span><strong>${escape(e.title)}</strong>${e.previousValue===null?'':`<small>これまで ${money(e.previousValue)}</small>`}</div><strong class="${BigInt(e.value)<0n?'negative':''}">${money(e.value)}</strong></div>`).join('')}</section>`;
}
