import{r as C,a as v,b as $,c as S,g as k,e as w,s as g,d as a,h as A,f as E,i as M}from"./permissions-BHUABBja.js";const q=C("config-form"),p=v("accounts"),_=v("accounts-empty"),L=v("add-account"),I=$("new-provider"),r=v("save-status"),O=[{value:"assigned_to_me",label:"Assigned to me"},{value:"created_by_me",label:"Created by me"},{value:"needs_my_review",label:"Needs my review"},{value:"all",label:"All I'm involved in"}],N=["open","merged","closed"];let l=[];async function T(){A();const e=await E();M({toggleId:"mode-toggle",mode:e.mode,onChange:s=>void g({mode:s})}),l=e.accounts,a("syncIntervalMinutes").value=String(e.syncIntervalMinutes),a("notifyNewMr").checked=e.notifyOn.newMr,a("notifyStatusChange").checked=e.notifyOn.statusChange,a("dispThemeControls").checked=e.display.themeControls,a("dispFilters").checked=e.display.filters,a("dispSort").checked=e.display.sort,a("dispOpenAll").checked=e.display.openAll,a("dispCredit").checked=e.display.credit,h()}function h(){_.hidden=l.length>0,p.replaceChildren();for(const e of l)p.insertAdjacentHTML("beforeend",x(e))}function x(e){const s=k(e.provider),o=s.fields.map(t=>{const u=e[t.key]??"";return`
        <label class="field-label">
          ${t.label}${t.required?" *":""}
          <input
            class="input"
            type="${t.secret?"password":"text"}"
            data-field="${t.key}"
            autocomplete="off"
            placeholder="${c(t.placeholder)}"
            value="${c(u)}"
          />
          ${t.hint?`<span class="hint">${c(t.hint)}</span>`:""}
        </label>`}).join(""),n=O.map(t=>`<option value="${t.value}"${e.scope===t.value?" selected":""}>${t.label}</option>`).join(""),i=N.map(t=>`
      <label class="check-row">
        <input type="checkbox" data-state="${t}"${e.states.includes(t)?" checked":""} />
        ${t}
      </label>`).join("");return`
    <div class="account-card card" data-id="${c(e.id)}">
      <div class="account-head">
        <div class="account-title">
          <input class="account-color" type="color" data-field="color" value="${c(e.color)}" title="Account color" aria-label="Account color" />
          <span class="badge provider-${e.provider}">${c(s.label)}</span>
          <input class="input account-label" data-field="label" value="${c(e.label)}" placeholder="Label" />
        </div>
        <div class="account-head-actions">
          <label class="check-row">
            <input type="checkbox" data-field="enabled"${e.enabled?" checked":""} /> Enabled
          </label>
          <button type="button" class="btn btn-sm" data-remove="${c(e.id)}">Remove</button>
        </div>
      </div>
      ${o}
      <p class="hint">
        <a href="${c(s.tokenDocsUrl)}" target="_blank" rel="noopener">How to create a read-only token</a>
      </p>
      <div class="account-filters">
        <label class="field-label">
          Scope
          <select class="select" data-field="scope">${n}</select>
        </label>
        <div>
          <p class="hint">States:</p>
          <div class="checks">${i}</div>
        </div>
      </div>
    </div>`}function m(){return Array.from(p.querySelectorAll(".account-card")).map(s=>{var b,f;const o=s.dataset.id??"",n=l.find(d=>d.id===o),i=(n==null?void 0:n.provider)??"gitlab",t=d=>{var y;return((y=s.querySelector(`[data-field="${d}"]`))==null?void 0:y.value.trim())??""},u=Array.from(s.querySelectorAll("input[data-state]:checked")).map(d=>d.dataset.state);return{id:o,provider:i,label:t("label")||i,host:t("host"),token:t("token"),username:t("username"),workspace:t("workspace"),scope:((b=s.querySelector('[data-field="scope"]'))==null?void 0:b.value)??"assigned_to_me",states:u.length?u:["open"],enabled:((f=s.querySelector('[data-field="enabled"]'))==null?void 0:f.checked)??!0,color:t("color")||(n==null?void 0:n.color)||"#e8590c"}})}L.addEventListener("click",()=>{const e=I.value;l=m(),l.push(S(e,k(e).label,l.length)),h()});p.addEventListener("click",e=>{const o=e.target.dataset.remove;o&&(l=m().filter(n=>n.id!==o),h())});q.addEventListener("submit",e=>{e.preventDefault(),j()});async function j(){r.textContent="Saving…",r.classList.remove("error");const e=m(),s=e.find(n=>n.enabled&&!n.token);if(s){r.textContent=`"${s.label}" needs a token.`,r.classList.add("error");return}const o=await w(e);if(await g({accounts:e,syncIntervalMinutes:Number(a("syncIntervalMinutes").value),notifyOn:{newMr:a("notifyNewMr").checked,statusChange:a("notifyStatusChange").checked,newComment:!1},display:{themeControls:a("dispThemeControls").checked,filters:a("dispFilters").checked,sort:a("dispSort").checked,openAll:a("dispOpenAll").checked,credit:a("dispCredit").checked}}),l=e,await chrome.runtime.sendMessage({type:"RESCHEDULE_ALARM"}),await chrome.runtime.sendMessage({type:"SYNC_NOW"}),!o){r.textContent="Saved, but self-hosted host access was denied.",r.classList.add("error");return}r.textContent="Saved. Background sync updated.",setTimeout(()=>{r.textContent=""},3e3)}function c(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}T();
