/** popup 逻辑 */
(function(){
  const $=id=>document.getElementById(id);
  let state,currentTab,currentHost,siteWhitelisted=false;
  async function refresh(){
    const[tab]=await chrome.tabs.query({active:true,currentWindow:true});
    currentTab=tab;
    try{currentHost=tab&&tab.url?new URL(tab.url).hostname:null}catch(_){currentHost=null}
    state=await NetBlockStorage.get();
    const locale=state.locale||"zh-CN";
    I18N.apply(document,locale);
    document.body.dataset.theme=state.theme;
    const accent=(NetBlock.ACCENT_COLORS.find(c=>c.id===state.accent)||NetBlock.ACCENT_COLORS[0]).value;
    document.documentElement.style.setProperty("--accent",accent);
    $("masterToggle").setAttribute("aria-checked",String(!!state.enabled));
    $("hostLabel").textContent=currentHost||I18N.t("currentSite",locale);
    siteWhitelisted=!!(currentHost&&state.whitelist.some(d=>currentHost===d||currentHost.endsWith("."+d)));
    $("siteStatus").textContent=siteWhitelisted?I18N.t("siteWhitelisted",locale):state.enabled?I18N.t("siteOn",locale):I18N.t("siteOff",locale);
    $("siteToggle").textContent=siteWhitelisted?I18N.t("restoreSite",locale):I18N.t("allowSite",locale);
    $("siteToggle").classList.toggle("on",siteWhitelisted);
    $("siteToggle").disabled=!currentHost;
    document.querySelectorAll("#intensitySeg button").forEach(b=>b.classList.toggle("active",b.dataset.v===state.intensity));
    $("intensityDesc").textContent=I18N.t("intensityDesc",locale)[state.intensity]||"";
    $("statReq").textContent=formatNum(state.stats.requests);
    $("statEl").textContent=formatNum(state.stats.elements);
    $("statDomains").textContent=formatNum(Object.keys(state.stats.byDomain||{}).length);
  }
  function formatNum(n){n=Number(n)||0;if(n>=10000)return(n/10000).toFixed(1)+"w";if(n>=1000)return(n/1000).toFixed(1)+"k";return String(n)}
  $("masterToggle").addEventListener("click",async()=>{await NetBlockStorage.set({enabled:!state.enabled});refresh()});
  $("siteToggle").addEventListener("click",async()=>{
    if(!currentHost)return;
    try{
      const resp=await chrome.runtime.sendMessage({type:"TOGGLE_SITE",host:currentHost,whitelisted:siteWhitelisted,tabId:currentTab?currentTab.id:null});
      if(resp&&resp.ok)window.close();else refresh();
    }catch(e){refresh()}
  });
  document.querySelectorAll("#intensitySeg button").forEach(b=>b.addEventListener("click",async()=>{await NetBlockStorage.set({intensity:b.dataset.v});refresh()}));
  $("openOptions").addEventListener("click",()=>chrome.runtime.openOptionsPage());
  $("pickerBtn").addEventListener("click",async()=>{
    if(!currentTab||!currentTab.id)return;
    try{await chrome.tabs.sendMessage(currentTab.id,{type:"START_PICKER"})}catch(_){}
    window.close();
  });
  refresh();
})();
