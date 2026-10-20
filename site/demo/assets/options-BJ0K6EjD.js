import{r as w,a as b,b as A,t as c,c as E,g as y,e as L,s as q,d as t,n as M,f as H,h as I,i as N,j as O,k as T,p as _}from"./permissions-CNVku4kR.js";const R=w("config-form"),v=b("accounts"),F=b("accounts-empty"),x=b("add-account"),j=A("new-provider"),u=b("save-status"),B=[{value:"assigned_to_me",label:c("scopeAssigned")},{value:"created_by_me",label:c("scopeCreated")},{value:"needs_my_review",label:c("scopeReview")},{value:"all",label:c("scopeAll")}],D=["open","merged","closed"];let r=[];async function U(){H(),I();const e=await N();O({toggleId:"mode-toggle",mode:e.mode,onChange:a=>void q({mode:a})}),r=e.accounts,t("syncIntervalMinutes").value=String(e.syncIntervalMinutes),t("notifyNewMr").checked=e.notifyOn.newMr,t("notifyStatusChange").checked=e.notifyOn.statusChange,t("notifyReviewRequested").checked=e.notifyOn.reviewRequested,t("notifyCiFailed").checked=e.notifyOn.ciFailed,t("notifyDigest").checked=e.digestNotifications,t("quietEnabled").checked=e.quietHours.enabled,t("ticketBaseUrl").value=e.ticketBaseUrl,t("quietStart").value=String(e.quietHours.start),t("quietEnd").value=String(e.quietHours.end),t("dispThemeControls").checked=e.display.themeControls,t("dispFilters").checked=e.display.filters,t("dispSort").checked=e.display.sort,t("dispOpenAll").checked=e.display.openAll,t("dispCredit").checked=e.display.credit,m()}function m(){F.hidden=r.length>0,v.replaceChildren();for(const e of r)v.insertAdjacentHTML("beforeend",P(e));v.querySelectorAll(".account-card").forEach(e=>{S(e)})}function k(e,a){return['<option value="">N/A</option>',...(a&&!e.includes(a)?[a,...e]:e).map(l=>`<option value="${i(l)}"${l===a?" selected":""}>${i(l)}</option>`)].join("")}async function S(e){var h,f;const a=y(e.dataset.provider),n=e.querySelector('select[data-field="workspace"]'),o=e.querySelector(".org-status"),l=((h=e.querySelector('[data-field="token"]'))==null?void 0:h.value.trim())??"",s=((f=e.querySelector('[data-field="host"]'))==null?void 0:f.value.trim())??"";if(!n||!a.listWorkspaces||!l)return;const d=n.value;n.disabled=!0;try{const p=await a.listWorkspaces(l,s);n.innerHTML=k(p,d),o&&(o.textContent="")}catch{n.innerHTML=k([],d),o&&(o.textContent=c("orgLoadFailed"))}finally{n.disabled=!1}}v.addEventListener("change",e=>{const a=e.target;if(a.dataset.field==="token"||a.dataset.field==="host"){const n=a.closest(".account-card");n&&S(n)}});function P(e){const a=y(e.provider),n=a.fields.map(s=>{const d=e[s.key]??"";return s.kind==="select"?`
        <label class="field-label">
          ${s.label}
          <select class="select" data-field="${s.key}">${k([],d)}</select>
          <span class="hint org-status"></span>
          ${s.hint?`<span class="hint">${i(s.hint)}</span>`:""}
        </label>`:`
        <label class="field-label">
          ${s.label}${s.required?" *":""}
          <input
            class="input"
            type="${s.secret?"password":"text"}"
            data-field="${s.key}"
            autocomplete="off"
            placeholder="${i(s.placeholder)}"
            value="${i(d)}"
          />
          ${s.hint?`<span class="hint">${i(s.hint)}</span>`:""}
        </label>`}).join(""),o=B.map(s=>`<option value="${s.value}"${e.scope===s.value?" selected":""}>${s.label}</option>`).join(""),l=D.map(s=>`
      <label class="check-row">
        <input type="checkbox" data-state="${s}"${e.states.includes(s)?" checked":""} />
        ${T(s)}
      </label>`).join("");return`
    <div class="account-card card" data-id="${i(e.id)}" data-provider="${e.provider}">
      <div class="account-head">
        <div class="account-title">
          <span class="badge provider-${e.provider}" title="${i(a.label)}">${_(e.provider)}</span>
          <input class="input account-label" data-field="label" value="${i(e.label)}" placeholder="${c("labelPlaceholder")}" />
        </div>
        <div class="account-head-actions">
          <label class="check-row">
            <input type="checkbox" data-field="enabled"${e.enabled?" checked":""} /> ${c("enabled")}
          </label>
          <button type="button" class="btn btn-sm" data-remove="${i(e.id)}">${c("remove")}</button>
        </div>
      </div>
      ${n}
      <p class="hint">
        <a href="${i(a.tokenDocsUrl)}" target="_blank" rel="noopener">${c("tokenHowTo")}</a>
      </p>
      <div class="account-filters">
        <label class="field-label">
          ${c("scope")}
          <select class="select" data-field="scope">${o}</select>
        </label>
        <div>
          <p class="hint">${c("statesLabel")}</p>
          <div class="checks">${l}</div>
        </div>
      </div>
    </div>`}function g(){return Array.from(v.querySelectorAll(".account-card")).map(a=>{var h,f;const n=a.dataset.id??"",o=r.find(p=>p.id===n),l=(o==null?void 0:o.provider)??"gitlab",s=p=>{var $;return(($=a.querySelector(`[data-field="${p}"]`))==null?void 0:$.value.trim())??""},d=Array.from(a.querySelectorAll("input[data-state]:checked")).map(p=>p.dataset.state);return{id:n,provider:l,label:s("label")||l,host:s("host"),token:s("token"),username:s("username"),workspace:s("workspace"),scope:((h=a.querySelector('[data-field="scope"]'))==null?void 0:h.value)??"assigned_to_me",states:d.length?d:["open"],enabled:((f=a.querySelector('[data-field="enabled"]'))==null?void 0:f.checked)??!0,color:(o==null?void 0:o.color)||"#e8590c"}})}x.addEventListener("click",()=>{const e=j.value;r=g(),r.push(E(e,y(e).label,r.length)),m()});v.addEventListener("click",e=>{const n=e.target.dataset.remove;n&&(r=g().filter(o=>o.id!==n),m())});R.addEventListener("submit",e=>{e.preventDefault(),W()});async function W(){u.textContent=c("saving"),u.classList.remove("error");const e=g(),a=e.find(o=>o.enabled&&!o.token);if(a){u.textContent=c("needsToken",a.label),u.classList.add("error");return}const n=await L(e);if(await q({accounts:e,syncIntervalMinutes:Number(t("syncIntervalMinutes").value),notifyOn:{newMr:t("notifyNewMr").checked,statusChange:t("notifyStatusChange").checked,newComment:!1,reviewRequested:t("notifyReviewRequested").checked,ciFailed:t("notifyCiFailed").checked},digestNotifications:t("notifyDigest").checked,ticketBaseUrl:M(t("ticketBaseUrl").value),quietHours:{enabled:t("quietEnabled").checked,start:C(Number(t("quietStart").value)),end:C(Number(t("quietEnd").value))},display:{themeControls:t("dispThemeControls").checked,filters:t("dispFilters").checked,sort:t("dispSort").checked,openAll:t("dispOpenAll").checked,credit:t("dispCredit").checked}}),r=e,await chrome.runtime.sendMessage({type:"RESCHEDULE_ALARM"}),await chrome.runtime.sendMessage({type:"SYNC_NOW"}),!n){u.textContent=c("hostAccessDenied"),u.classList.add("error");return}u.textContent=c("saved"),setTimeout(()=>{u.textContent=""},3e3)}function i(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}U();function C(e){return Number.isInteger(e)&&e>=0&&e<=23?e:0}
