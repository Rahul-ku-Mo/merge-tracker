import{g as _,f as U,c as le,e as de,s as M,a as i,j as ue,h as pe,k as fe,l as me,i as he,m as X,n as ge,o as V}from"./permissions-BHUABBja.js";const be={github:'<path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>',gitlab:'<path d="m23.6004 9.5927-.0337-.0862L20.3.9814a.851.851 0 0 0-.3362-.405.8748.8748 0 0 0-.9997.0539.8748.8748 0 0 0-.29.4399l-2.2055 6.748H7.5375l-2.2057-6.748a.8573.8573 0 0 0-.29-.4412.8748.8748 0 0 0-.9997-.0537.8585.8585 0 0 0-.3362.4049L.4332 9.5015l-.0325.0862a6.0657 6.0657 0 0 0 2.0119 7.0105l.0113.0087.03.0213 4.976 3.7264 2.462 1.8633 1.4995 1.1321a1.0085 1.0085 0 0 0 1.2197 0l1.4995-1.1321 2.462-1.8633 5.006-3.7489.0125-.01a6.0682 6.0682 0 0 0 2.0094-7.003z"/>',bitbucket:'<path d="M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 0 0 .77-.646l3.27-20.03a.768.768 0 0 0-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z"/>'};function P(e,t=""){return`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"${t?` class="${t}"`:""}>${be[e]}</svg>`}const ye=["github","gitlab","bitbucket"],ve={github:{scopes:["repo","read:user"],note:"Fine-grained token with Pull requests: Read is enough for listing.",tokenPlaceholder:"github_pat_… or ghp_…"},gitlab:{scopes:["read_api"],note:"Read-only access to list merge requests. Stored only on this device.",tokenPlaceholder:"glpat-xxxxxxxxxxxxxx"},bitbucket:{scopes:["pullrequest:read"],note:"App password with Pull requests: Read. Username + workspace required.",tokenPlaceholder:"App password"}};function we(e){const t=document.getElementById("connect-panel");if(!t)throw new Error("connect-panel element missing");const n=t.querySelector("#connect-list"),s=t.querySelector("#connect-form-wrap"),o=t.querySelector("#connect-form"),c=t.querySelector("#connect-back"),b=t.querySelector("#connect-error");if(!n||!s||!o||!c||!b)throw new Error("connect panel elements missing");let v=null;function w(a){b.textContent=a,b.hidden=!a}function $(){v=null,s.hidden=!0,n.hidden=!1,w(""),n.replaceChildren();for(const a of ye){const l=_(a),d=document.createElement("button");d.type="button",d.className="connect-card",d.dataset.provider=a,d.innerHTML=`
        <span class="connect-card-icon badge provider-${a}">${P(a)}</span>
        <span class="connect-card-body">
          <span class="connect-card-name">${p(l.label)}</span>
          <span class="connect-card-status">Not connected</span>
        </span>
        <span class="connect-card-action">Connect</span>
      `,d.addEventListener("click",()=>A(a)),n.appendChild(d)}}function A(a){var I;v=a,w(""),n.hidden=!0,s.hidden=!1;const l=_(a),d=ve[a],j=l.fields.find(u=>u.key==="token"),ce=l.fields.filter(u=>u.key!=="token"),re=d.scopes.map(u=>`<span class="connect-scope">${p(u)}</span>`).join(""),ie=ce.map(u=>`
        <label class="connect-field">
          <span class="connect-field-label">${p(u.label)}${u.required?" *":""}</span>
          <input
            class="input"
            type="text"
            name="${u.key}"
            autocomplete="off"
            placeholder="${p(u.placeholder)}"
            ${u.required?"required":""}
          />
          ${u.hint?`<span class="connect-field-hint">${p(u.hint)}</span>`:""}
        </label>`).join("");o.innerHTML=`
      <div class="connect-form-head">
        <span class="connect-form-icon badge provider-${a}">${P(a)}</span>
        <div class="connect-form-title">
          <strong>${p(l.label)}</strong>
          <span>Not connected</span>
        </div>
      </div>
      ${ie}
      <label class="connect-field">
        <span class="connect-field-label">${p((j==null?void 0:j.label)??"Token")} *</span>
        <input
          class="input"
          type="password"
          name="token"
          autocomplete="off"
          placeholder="${p(d.tokenPlaceholder)}"
          required
        />
      </label>
      <a class="connect-docs" href="${p(l.tokenDocsUrl)}" target="_blank" rel="noopener">
        Create a read-only token →
      </a>
      <div class="connect-scopes card">
        <p class="connect-scopes-title">Required scopes</p>
        <div class="connect-scopes-tags">${re}</div>
        <p class="connect-scopes-note">${p(d.note)}</p>
      </div>
      <button type="submit" class="btn btn-primary connect-submit">Connect ${p(l.label)}</button>
    `,(I=o.querySelector('input[name="token"]'))==null||I.focus()}return c.addEventListener("click",()=>$()),o.addEventListener("submit",a=>{a.preventDefault(),v&&$e(v,o,w,e)}),$(),{root:t,show:()=>{t.hidden=!1,$()},hide:()=>{t.hidden=!0,w("")}}}async function $e(e,t,n,s){n("");const o=t.querySelector(".connect-submit");o&&(o.disabled=!0);try{const c=new FormData(t),b=String(c.get("token")??"").trim();if(!b){n("Token is required.");return}const v=_(e),w=await U(),$=le(e,v.label,w.accounts.length);for(const l of v.fields){if(l.key==="token"){$.token=b;continue}const d=String(c.get(l.key)??"").trim();if(l.required&&!d){n(`${l.label} is required.`);return}$[l.key]=d}const A=[...w.accounts,$],a=await de(A);if(await M({accounts:A}),await chrome.runtime.sendMessage({type:"RESCHEDULE_ALARM"}),await chrome.runtime.sendMessage({type:"SYNC_NOW"}),!a){n("Saved, but self-hosted host access was denied.");return}s()}catch(c){const b=c instanceof Error?c.message:String(c);n(b)}finally{o&&(o.disabled=!1)}}function p(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}const f=i("status"),N=i("controls"),x=i("filter-project"),R=i("filter-state"),E=i("sort-btn"),Z=i("open-all-btn"),H=i("muted-bar"),ke=i("muted-text"),Se=i("unmute-btn"),m=i("mr-list"),T=i("empty-state"),W=T.querySelector(".empty-title"),Y=T.querySelector(".empty-desc"),q=i("sync-btn"),ee=i("last-sync"),Ce=i("options-link");let C=[],r,y,h=new Set;const L=new Map;let te=!0,k=null;Ce.addEventListener("click",e=>{e.preventDefault(),chrome.runtime.openOptionsPage()});q.addEventListener("click",()=>void ae(!0));async function Ee(){pe(),r=await fe(),y=await me(),R.value=r.state,oe(),_e();const e=await U();he({toggleId:"mode-toggle",mode:e.mode,onChange:n=>void M({mode:n})}),L.clear();for(const n of e.accounts)L.set(n.id,{color:n.color,label:n.label});if(h=new Set(e.mutedRepos),qe(e.display),k=we(()=>void G()),!e.accounts.some(n=>n.enabled&&n.token.trim())){xe();return}await G()}async function G(){k==null||k.hide(),f.hidden=!1,q.hidden=!1;const e=await U();L.clear();for(const t of e.accounts)L.set(t.id,{color:t.color,label:t.label});h=new Set(e.mutedRepos),await O(),await ae(!1)}function xe(){f.hidden=!0,N.hidden=!0,m.hidden=!0,T.hidden=!0,H.hidden=!0,q.hidden=!0,ee.textContent="",k==null||k.show()}function qe(e){var n;((s,o)=>{const c=document.getElementById(s);c&&(c.hidden=o)})("mode-toggle",!e.themeControls),x.hidden=!e.filters,R.hidden=!e.filters,E.hidden=!e.sort,Z.hidden=!e.openAll,(n=document.querySelector(".credit"))==null||n.toggleAttribute("hidden",!e.credit),te=e.filters||e.sort||e.openAll}async function O(){const{mergeRequests:e,lastSyncAt:t}=await ue();C=e,z(),B(),F(),ee.textContent=t?`Synced ${ze(t)}`:""}function z(){const e=[...new Set(C.filter(s=>!h.has(s.repo)).map(s=>s.repo))].sort((s,o)=>s.localeCompare(o)),t=[{value:"all",label:"All projects"},...e.map(s=>({value:s,label:s}))];t.some(s=>s.value===r.project)||(r.project="all"),x.replaceChildren();for(const s of t){const o=document.createElement("option");o.value=s.value,o.textContent=s.label,x.appendChild(o)}x.value=r.project}function B(){if(De(),!C.length){N.hidden=!0,m.hidden=!0,Q("No merge requests","Click Sync or check your filters in Settings."),S("No merge requests yet. Click Sync.","default");return}N.hidden=!te;const e=C.filter(s=>!h.has(s.repo)),t=se(e.filter(ne));if(!t.length){m.hidden=!0,Q("No matches","Try changing the filters above."),S(`0 of ${e.length} shown`,"default");return}T.hidden=!0,Te(Le(t)),m.hidden=!1;const n=t.length===e.length?`${e.length} request${e.length===1?"":"s"}`:`${t.length} of ${e.length} shown`;S(n,"success"),je()}function ne(e){return!(r.project!=="all"&&e.repo!==r.project||r.state!=="all"&&e.state!==r.state)}function se(e){const t=r.sort==="updated_asc"?1:-1;return[...e].sort((n,s)=>t*(new Date(n.updatedAt).getTime()-new Date(s.updatedAt).getTime()))}function Le(e){const t=new Map;for(const n of e){const s=t.get(n.repo)??[];s.push(n),t.set(n.repo,s)}return[...t.entries()].map(([n,s])=>({repo:n,items:s}))}function Te(e){var s;const t=Ae(),n=m.scrollTop;m.replaceChildren();for(const o of e){const c=document.createElement("div");c.className="mr-group",c.innerHTML=`
      <div class="mr-group-header">
        <span class="mr-group-name">${g(o.repo)}</span>
        <span class="mr-group-count">${o.items.length}</span>
      </div>
      <ul class="mr-group-list">${o.items.map(Re).join("")}</ul>
    `,m.appendChild(c)}m.scrollTop=n,t&&((s=m.querySelector(t))==null||s.focus())}function Ae(){const e=document.activeElement;if(!(e instanceof HTMLElement)||!m.contains(e))return null;const{key:t,copy:n,mute:s}=e.dataset;return t?`.mr-title[data-key="${CSS.escape(t)}"]`:n?`[data-copy="${CSS.escape(n)}"]`:s?`[data-mute="${CSS.escape(s)}"]`:null}function Re(e){const t=L.get(e.accountId),n=(t==null?void 0:t.color)??"#888",s=Be(e),o=y.opened.includes(e.key);return`
    <li class="${["mr-item",s?"is-new":"",o?"is-read":""].filter(Boolean).join(" ")}">
      <div class="mr-row">
        <span class="acct-dot" style="background:${g(n)}" title="${g((t==null?void 0:t.label)??"")}" aria-label="Account: ${g((t==null?void 0:t.label)??"")}" role="img"></span>
        <a class="mr-title" href="${g(e.url)}" data-key="${g(e.key)}" target="_blank" rel="noopener">${g(e.title)}</a>
        <span class="mr-actions">
          <button class="mr-action" type="button" data-copy="${g(e.url)}" title="Copy link" aria-label="Copy link">
            ${V("copy",13)}
          </button>
          <button class="mr-action" type="button" data-mute="${g(e.repo)}" title="Mute this project" aria-label="Mute this project">
            ${V("eye-off",13)}
          </button>
        </span>
      </div>
      <span class="mr-meta">
        ${Me(e.provider)}
        <span class="badge ${e.state}">${e.state}</span>
        ${e.draft?'<span class="badge draft">draft</span>':""}
        <span class="mr-meta-sep">·</span>
        <span>#${e.number}</span>
        <span class="mr-meta-sep">·</span>
        <span>${g(e.author)}</span>
      </span>
    </li>
  `}function Me(e){const t=P(e);return`<span class="badge provider-${e} mr-provider" title="${e}">${t}</span>`}function Be(e){const t=y.seen[e.key];return t?new Date(e.updatedAt).getTime()>new Date(t).getTime():!0}function je(){for(const e of C)y.seen[e.key]=e.updatedAt;X(y)}function De(){if(!h.size){H.hidden=!0;return}H.hidden=!1;const e=h.size;ke.textContent=`${e} project${e===1?"":"s"} muted`}async function F(){const e=C.filter(t=>t.state==="open"&&!h.has(t.repo)).length;await chrome.action.setBadgeBackgroundColor({color:"#0965ce"}),await chrome.action.setBadgeText({text:e>0?String(e):""})}function _e(){x.addEventListener("change",()=>{r.project=x.value,D()}),R.addEventListener("change",()=>{r.state=R.value,D()}),E.addEventListener("click",()=>{r.sort=r.sort==="updated_desc"?"updated_asc":"updated_desc",oe(),D()}),Z.addEventListener("click",()=>Pe()),Se.addEventListener("click",()=>void Oe()),m.addEventListener("click",e=>{const t=e.target,n=t.closest("[data-copy]");if(n){Ne(n.dataset.copy??"");return}const s=t.closest("[data-mute]");if(s){He(s.dataset.mute??"");return}const o=t.closest(".mr-title");o!=null&&o.dataset.key&&Ue(o.dataset.key)})}function oe(){const e=r.sort==="updated_asc";E.classList.toggle("is-asc",e),E.title=e?"Sort: oldest first":"Sort: newest first",E.setAttribute("aria-label",E.title)}function Pe(){const e=se(C.filter(t=>!h.has(t.repo)).filter(ne));for(const t of e)t.url&&chrome.tabs.create({url:t.url,active:!1})}async function Ne(e){if(e)try{await navigator.clipboard.writeText(e),K("Link copied")}catch{K("Could not copy")}}async function He(e){e&&(h.add(e),await M({mutedRepos:[...h]}),z(),B(),F())}async function Oe(){h.clear(),await M({mutedRepos:[]}),z(),B(),F()}function Ue(e){y.opened.includes(e)||(y.opened.push(e),X(y))}async function D(){B(),await ge(r)}async function ae(e){q.disabled=!0,S("Syncing…","loading");try{const t=await chrome.runtime.sendMessage({type:"SYNC_NOW"});if(!(t!=null&&t.ok))throw new Error((t==null?void 0:t.error)??"Sync failed");await O(),t.errors.length&&S(`${t.count} request(s) · ${t.errors.length} account(s) failed`,"error")}catch(t){if(e){const n=t instanceof Error?t.message:String(t);S(n,"error")}else await O()}finally{q.disabled=!1}}function S(e,t="default"){f.textContent=e,f.hidden=!1,f.classList.remove("is-error","is-success","is-loading","is-info"),t==="error"&&f.classList.add("is-error"),t==="success"&&f.classList.add("is-success"),t==="loading"&&f.classList.add("is-loading"),t==="info"&&f.classList.add("is-info")}let J;function K(e){const t=f.textContent??"";S(e,"success"),window.clearTimeout(J),J=window.setTimeout(()=>{f.textContent=t},1500)}function Q(e,t){W&&(W.textContent=e),Y&&(Y.textContent=t),T.hidden=!1}function ze(e){const t=Date.now()-new Date(e).getTime(),n=Math.floor(t/6e4);if(n<1)return"just now";if(n<60)return`${n}m ago`;const s=Math.floor(n/60);return s<24?`${s}h ago`:new Date(e).toLocaleString()}function g(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}Ee();
