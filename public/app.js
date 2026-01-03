    const DEFAULT_STATE = {
      players: ["Lilian", "Albane", "France-Pascale", "Laurent"],
      target: 66,
      rounds: [],
      roundIds: [],
      games: []
    };

    const ACTIVE_MATCH_KEY = "take6_active_match_id";

    function structuredCloneSafe(obj){ return JSON.parse(JSON.stringify(obj)); }

    function getActiveMatchId(){ return localStorage.getItem(ACTIVE_MATCH_KEY); }
    function setActiveMatchId(id){
      if(id){ localStorage.setItem(ACTIVE_MATCH_KEY, id); }
      else { localStorage.removeItem(ACTIVE_MATCH_KEY); }
    }

    async function apiFetch(path, options){
      const res = await fetch(path, {
        headers: {"Content-Type":"application/json"},
        ...options
      });
      if(!res.ok){
        const text = await res.text();
        throw new Error(text || "Erreur API");
      }
      if(res.status === 204) return null;
      return res.json();
    }

    let state = structuredCloneSafe(DEFAULT_STATE);
    let activeMatchId = getActiveMatchId();

    // DOM
    const theadRow = document.getElementById("theadRow");
    const tbody = document.getElementById("tbody");
    const totalsRow = document.getElementById("totalsRow");
    const addRoundBtn = document.getElementById("addRoundBtn");
    const undoBtn = document.getElementById("undoBtn");
    const newGameBtn = document.getElementById("newGameBtn");
    const endGameBtn = document.getElementById("endGameBtn");
    const exportBtn = document.getElementById("exportBtn");
    const importBtn = document.getElementById("importBtn");
    const importFile = document.getElementById("importFile");
    const targetInput = document.getElementById("target");

    const nameInputs = [
      document.getElementById("p0"),
      document.getElementById("p1"),
      document.getElementById("p2"),
      document.getElementById("p3"),
    ];

    const rankingEl = document.getElementById("ranking");
    const statusBadges = document.getElementById("statusBadges");
    const winnerHint = document.getElementById("winnerHint");

    // Stats
    const kpiEl = document.getElementById("kpi");
    const leadersEl = document.getElementById("leaders");
    const statsTableWrap = document.getElementById("statsTableWrap");
    const historyWrap = document.getElementById("historyWrap");

    // Modal
    const addPointsDialog = document.getElementById("addPointsDialog");
    const addPointsForm = document.getElementById("addPointsForm");
    const addPointsSubtitle = document.getElementById("addPointsSubtitle");
    const addPointsValue = document.getElementById("addPointsValue");
    const addPointsCancel = document.getElementById("addPointsCancel");
    const addPointsClear = document.getElementById("addPointsClear");
    let addPointsPlayerIndex = null;

    const roundUpdateTimers = new Map();
    const playerUpdateTimers = new Map();
    let targetUpdateTimer = null;

    function schedulePlayersUpdate(){
      const existing = playerUpdateTimers.get("players");
      if(existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        updateMatchPlayers().catch((err) => {
          console.error("players_update_failed", err);
        });
      }, 300);
      playerUpdateTimers.set("players", timer);
    }

    function scheduleTargetUpdate(){
      if(targetUpdateTimer) clearTimeout(targetUpdateTimer);
      targetUpdateTimer = setTimeout(() => {
        updateMatchTarget().catch((err) => {
          console.error("target_update_failed", err);
        });
      }, 300);
    }

    function scheduleRoundUpdate(ri){
      const existing = roundUpdateTimers.get(ri);
      if(existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        updateRoundScores(ri).catch((err) => {
          console.error("round_update_failed", err);
        });
      }, 250);
      roundUpdateTimers.set(ri, timer);
    }

    // Helpers
    const clampInt = (v) => {
      if(v === "" || v === null || v === undefined) return null;
      const n = Number(v);
      if(!isFinite(n)) return null;
      const i = Math.trunc(n);
      return i < 0 ? 0 : i;
    };

    function escapeHtml(s){
      return String(s).replace(/[&<>"']/g, (c)=>({
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
      }[c]));
    }

    function sumForPlayerFromRounds(rounds, pi){
      let s = 0;
      for(const r of rounds){
        const v = r?.[pi];
        if(typeof v === "number" && isFinite(v)) s += v;
      }
      return s;
    }
    function totalsFromRounds(rounds){ return [0,1,2,3].map(i => sumForPlayerFromRounds(rounds, i)); }
    function totals(){ return totalsFromRounds(state.rounds); }

    function ranksFromTotals(tots){ return tots.map(t => 1 + tots.filter(x => x < t).length); }

    function minIndices(arr){
      const min = Math.min(...arr);
      const idx = [];
      arr.forEach((v,i)=>{ if(v===min) idx.push(i); });
      return idx;
    }
    function anyReachedTarget(tots){ return tots.some(v => v >= state.target); }
    function formatRoundLabel(i){ return `Manche ${i+1}`; }

    function formatDate(iso){
      try{
        const d = new Date(iso);
        return d.toLocaleString("fr-FR", {year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit"});
      }catch(e){ return iso; }
    }

    function applyMatchPayload(payload){
      if(!payload) return;
      state.players = payload.players?.length === 4 ? payload.players.slice() : state.players;
      state.target = typeof payload.target === "number" ? payload.target : state.target;
      state.rounds = Array.isArray(payload.rounds) ? payload.rounds : [];
      state.roundIds = Array.isArray(payload.roundIds) ? payload.roundIds : [];
      activeMatchId = payload.id || activeMatchId;
      if(activeMatchId) setActiveMatchId(activeMatchId);
    }

    async function loadActiveMatch(){
      if(!activeMatchId) return;
      try{
        const match = await apiFetch(`/api/matches/${activeMatchId}`);
        applyMatchPayload(match);
      }catch(e){
        setActiveMatchId(null);
        activeMatchId = null;
      }
    }

    async function loadHistory(){
      try{
        const res = await apiFetch(`/api/matches?limit=200`);
        state.games = Array.isArray(res?.games) ? res.games : [];
      }catch(e){
        state.games = [];
      }
    }

    async function bootstrap(){
      await Promise.all([loadActiveMatch(), loadHistory()]);
      render();
    }

    async function createMatch(){
      const payload = await apiFetch(`/api/matches`, {
        method: "POST",
        body: JSON.stringify({
          players: state.players.slice(),
          target: state.target
        })
      });
      applyMatchPayload(payload);
      return activeMatchId;
    }

    async function ensureActiveMatch(){
      if(activeMatchId) return activeMatchId;
      return createMatch();
    }

    async function createRound(){
      await ensureActiveMatch();
      const payload = await apiFetch(`/api/matches/${activeMatchId}/rounds`, {
        method: "POST",
        body: JSON.stringify({ scores: [null, null, null, null] })
      });
      state.rounds.push([null, null, null, null]);
      state.roundIds.push(payload.roundId);
    }

    async function updateRoundScores(ri){
      const roundId = state.roundIds[ri];
      if(!roundId || !activeMatchId) return;
      const scores = state.rounds[ri];
      await apiFetch(`/api/matches/${activeMatchId}/rounds/${roundId}`, {
        method: "PUT",
        body: JSON.stringify({ scores })
      });
    }

    async function deleteLastRound(){
      if(!activeMatchId) return;
      const payload = await apiFetch(`/api/matches/${activeMatchId}/rounds/last`, { method: "DELETE" });
      if(payload?.deleted){
        state.rounds.pop();
        state.roundIds.pop();
      }
    }

    async function finishMatch(){
      if(!activeMatchId) return;
      await apiFetch(`/api/matches/${activeMatchId}/end`, { method: "POST" });
      setActiveMatchId(null);
      activeMatchId = null;
      state.rounds = [];
      state.roundIds = [];
      await loadHistory();
    }

    async function deleteActiveMatch(){
      if(!activeMatchId) return;
      await apiFetch(`/api/matches/${activeMatchId}`, { method: "DELETE" });
      setActiveMatchId(null);
      activeMatchId = null;
      state.rounds = [];
      state.roundIds = [];
    }

    async function updateMatchPlayers(){
      if(!activeMatchId) return;
      await apiFetch(`/api/matches/${activeMatchId}/players`, {
        method: "PUT",
        body: JSON.stringify({ players: state.players.slice() })
      });
    }

    async function updateMatchTarget(){
      if(!activeMatchId) return;
      await apiFetch(`/api/matches/${activeMatchId}`, {
        method: "PATCH",
        body: JSON.stringify({ target: state.target })
      });
    }

    async function deleteMatchFromHistory(id){
      await apiFetch(`/api/matches/${id}`, { method: "DELETE" });
      state.games = state.games.filter(g => g.id !== id);
    }

    async function ensureAtLeastOneRound(){
      if(state.rounds.length === 0){
        await createRound();
      }
    }

    function normalizeRounds(rounds){
      return rounds.map(r => {
        const out = [0,0,0,0];
        for(let i=0;i<4;i++){
          const v = r?.[i];
          out[i] = (typeof v === "number" && isFinite(v) && v >= 0) ? Math.trunc(v) : 0;
        }
        return out;
      });
    }

    function longestZeroStreak(rounds, pi){
      let best = 0, cur = 0;
      for(const r of rounds){
        if((r?.[pi] ?? 0) === 0){ cur++; best = Math.max(best, cur); }
        else cur = 0;
      }
      return best;
    }

    function maxSingleRound(rounds, pi){
      let best = 0;
      for(const r of rounds){
        const v = r?.[pi];
        if(typeof v === "number" && isFinite(v)) best = Math.max(best, v);
      }
      return best;
    }

    // Render
    function render(){
      nameInputs.forEach((inp, i) => { if(inp.value !== state.players[i]) inp.value = state.players[i]; });
      targetInput.value = state.target;

      while(theadRow.children.length > 1) theadRow.removeChild(theadRow.lastChild);
      state.players.forEach((p) => {
        const th = document.createElement("th");
        th.textContent = p;
        theadRow.appendChild(th);
      });

      tbody.innerHTML = "";
      state.rounds.forEach((r, ri) => {
        const tr = document.createElement("tr");
        const td0 = document.createElement("td");
        td0.textContent = formatRoundLabel(ri);
        tr.appendChild(td0);

        for(let pi=0; pi<4; pi++){
          const td = document.createElement("td");
          const input = document.createElement("input");
          input.type = "number";
          input.min = "0";
          input.step = "1";
          input.inputMode = "numeric";
          input.className = "cell-input";
          const v = r?.[pi];
          input.value = (typeof v === "number" && isFinite(v)) ? String(v) : "";
          input.placeholder = "0";
          input.addEventListener("input", (e) => {
            const val = clampInt(e.target.value);
            state.rounds[ri][pi] = val;
            scheduleRoundUpdate(ri);
            renderTotalsAndRanking();
          });
          td.appendChild(input);
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });

      while(totalsRow.children.length > 1) totalsRow.removeChild(totalsRow.lastChild);
      for(let pi=0; pi<4; pi++){
        const td = document.createElement("td");
        td.id = `total_${pi}`;
        td.textContent = "0";
        totalsRow.appendChild(td);
      }

      renderTotalsAndRanking();
      renderStats();

      undoBtn.disabled = state.rounds.length === 0;
      endGameBtn.disabled = state.rounds.length === 0;
    }

    function renderTotalsAndRanking(){
      const tots = totals();
      const leaders = minIndices(tots);

      for(let pi=0; pi<4; pi++){
        const td = document.getElementById(`total_${pi}`);
        td.textContent = String(tots[pi]);
        td.style.color = leaders.includes(pi) ? "var(--good)" : "var(--text)";
        td.style.fontWeight = leaders.includes(pi) ? "900" : "850";
      }

      statusBadges.innerHTML = "";
      const leaderBadge = document.createElement("span");
      leaderBadge.className = "badge";
      leaderBadge.innerHTML = `<span class="dot good"></span>Leader : <b style="margin-left:6px">${leaders.map(i=>escapeHtml(state.players[i])).join(" / ")}</b>`;
      statusBadges.appendChild(leaderBadge);

      if(anyReachedTarget(tots)){
        const overBadge = document.createElement("span");
        overBadge.className = "badge";
        overBadge.innerHTML = `<span class="dot bad"></span>Seuil ${state.target} atteint`;
        statusBadges.appendChild(overBadge);
      } else {
        const progBadge = document.createElement("span");
        progBadge.className = "badge";
        const max = Math.max(...tots);
        const pct = Math.min(100, Math.round((max / state.target) * 100));
        progBadge.innerHTML = `<span class="dot warn"></span>Progression : <b style="margin-left:6px">${pct}%</b>`;
        statusBadges.appendChild(progBadge);
      }

      const items = [0,1,2,3].map(i => ({i, name: state.players[i], total: tots[i], rank: 0}))
                             .sort((a,b)=> a.total - b.total);
      const rankByIdx = ranksFromTotals(tots);
      items.forEach(it => it.rank = rankByIdx[it.i]);

      rankingEl.innerHTML = "";
      items.forEach((it) => {
        const div = document.createElement("div");
        div.className = "rank-item" + (it.rank===1 ? " win" : "") + ((tots[it.i] >= state.target) ? " over" : "");
        div.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;min-width:240px">
            <span class="pos">${it.rank}</span>
            <div>
              <div style="font-weight:850">${escapeHtml(it.name)}</div>
              <div class="small">${(tots[it.i] >= state.target) ? `≥ ${state.target} (seuil)` : "&nbsp;"}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <button type="button" class="btn" data-add-points="${it.i}" title="Ajouter des points à ${escapeHtml(it.name)}">+ Ajouter</button>
            <b>${it.total}</b>
          </div>
        `;
        rankingEl.appendChild(div);
      });

      if(anyReachedTarget(tots)){
        winnerHint.innerHTML = `Fin de partie probable : seuil atteint. Gagnant provisoire : <b style="color:var(--good)">${leaders.map(i=>escapeHtml(state.players[i])).join(" / ")}</b>.`;
      } else if(state.rounds.length === 0){
        winnerHint.textContent = "Ajoutez une manche pour commencer.";
      } else {
        winnerHint.innerHTML = `Gagnant provisoire : <b style="color:var(--good)">${leaders.map(i=>escapeHtml(state.players[i])).join(" / ")}</b>.`;
      }
    }

    // Modal logic
    async function openAddPoints(pi){
      addPointsPlayerIndex = pi;
      await ensureAtLeastOneRound();
      const playerName = state.players[pi] || `J${pi+1}`;
      addPointsSubtitle.innerHTML = `Joueur : <b>${escapeHtml(playerName)}</b> • Manche ciblée : <b>la dernière</b>`;
      addPointsValue.value = "";
      if(typeof addPointsDialog.showModal === "function"){
        addPointsDialog.showModal();
      }else{
        const v = prompt(`Ajouter combien de points à ${playerName} ?`, "0");
        const pts = clampInt(v);
        if(pts !== null) await applyAddPoints(pi, pts);
      }
      setTimeout(()=> addPointsValue.focus(), 50);
    }

    async function applyAddPoints(pi, pts){
      if(pts === null) return;
      await ensureAtLeastOneRound();
      const ri = state.rounds.length - 1;
      const current = (typeof state.rounds[ri][pi] === "number" && isFinite(state.rounds[ri][pi])) ? state.rounds[ri][pi] : 0;
      state.rounds[ri][pi] = current + pts;
      scheduleRoundUpdate(ri);
      render();
      setTimeout(()=> {
        const lastRow = tbody.lastElementChild;
        if(!lastRow) return;
        const inp = lastRow.querySelectorAll("input.cell-input")[pi];
        if(!inp) return;
        const prev = inp.style.outline;
        inp.style.outline = "2px solid rgba(0,217,255,.65)";
        setTimeout(()=> inp.style.outline = prev, 450);
      }, 0);
    }

    addPointsDialog.addEventListener("click", (e) => {
      const rect = addPointsForm.getBoundingClientRect();
      const x = e.clientX, y = e.clientY;
      const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      if(!inside) addPointsDialog.close("cancel");
    });
    addPointsCancel.addEventListener("click", () => addPointsDialog.close("cancel"));
    addPointsClear.addEventListener("click", () => { addPointsValue.value = ""; addPointsValue.focus(); });
    addPointsForm.querySelectorAll("[data-quick]").forEach(btn => {
      btn.addEventListener("click", () => {
        const inc = Number(btn.getAttribute("data-quick"));
        const cur = clampInt(addPointsValue.value) ?? 0;
        addPointsValue.value = String(cur + inc);
        addPointsValue.focus();
      });
    });
    addPointsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const pts = clampInt(addPointsValue.value);
      if(addPointsPlayerIndex === null) return addPointsDialog.close("cancel");
      if(pts === null) return addPointsDialog.close("cancel");
      addPointsDialog.close("ok");
      applyAddPoints(addPointsPlayerIndex, pts).catch((err) => {
        console.error("add_points_failed", err);
      });
    });

    // Actions
    async function addRound(){
      await createRound();
      render();
      setTimeout(() => {
        const lastRow = tbody.lastElementChild;
        const inp = lastRow?.querySelector("input");
        inp?.focus();
      }, 0);
    }

    async function undoRound(){
      if(state.rounds.length === 0) return;
      await deleteLastRound();
      render();
    }

    async function newGame(){
      const ok = confirm("Nouvelle partie : effacer toutes les manches et remettre les scores à zéro ? (L'historique des parties est conservé)");
      if(!ok) return;
      await deleteActiveMatch();
      render();
    }

    async function endGame(){
      if(state.rounds.length === 0){
        alert("Aucune manche à archiver.");
        return;
      }
      const tots = totals();
      const leaders = minIndices(tots);
      const names = leaders.map(i => state.players[i]).join(" / ");
      const ok = confirm(`Fin de partie : archiver la partie ?
Gagnant provisoire: ${names}

(Conseil: faites-le quand la partie est réellement terminée.)`);
      if(!ok) return;

      await finishMatch();
      render();
    }

    function exportJSON(){
      const data = {...state, exported_at: new Date().toISOString(), version: "v4_db"};
      const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
      a.href = url;
      a.download = `6-qui-prend-score-stats-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    function importJSONFile(file){
      const reader = new FileReader();
      reader.onload = async () => {
        try{
          const obj = JSON.parse(reader.result);
          const st = {
            players: Array.isArray(obj.players) ? obj.players : DEFAULT_STATE.players,
            target: typeof obj.target === "number" ? obj.target : DEFAULT_STATE.target,
            rounds: Array.isArray(obj.rounds) ? obj.rounds : [],
            games: Array.isArray(obj.games) ? obj.games : []
          };
          if(st.players.length !== 4) throw new Error("players length");

          st.rounds = st.rounds.map(r => {
            if(!Array.isArray(r) || r.length !== 4) return [null,null,null,null];
            return r.map(v => (typeof v === "number" && isFinite(v) && v >= 0) ? Math.trunc(v) : null);
          });

          st.games = st.games.filter(g => g && Array.isArray(g.players) && g.players.length === 4 && Array.isArray(g.rounds))
                             .map(g => {
                               const rounds = normalizeRounds(g.rounds);
                               const totals = Array.isArray(g.totals) && g.totals.length === 4 ? g.totals.map(x=>Math.trunc(Number(x)||0)) : totalsFromRounds(rounds);
                               const ranks = Array.isArray(g.ranks) && g.ranks.length === 4 ? g.ranks.map(x=>Math.trunc(Number(x)||1)) : ranksFromTotals(totals);
                               return {
                                 id: g.id || ("g_" + Math.random().toString(16).slice(2)),
                                 endedAt: g.endedAt || new Date().toISOString(),
                                 target: typeof g.target === "number" ? g.target : 66,
                                 players: g.players.slice(),
                                 rounds, totals, ranks
                               };
                             });

          await apiFetch("/api/import", {
            method: "POST",
            body: JSON.stringify({ games: st.games })
          });
          await loadHistory();
          render();
          alert("Import réussi ✅");
        }catch(e){
          alert("Impossible d'importer ce fichier (format JSON inattendu ou erreur serveur).");
        }
      };
      reader.readAsText(file);
    }

    async function deleteGame(id){
      const g = state.games.find(x => x.id === id);
      if(!g) return;
      const ok = confirm(`Supprimer cette partie du ${formatDate(g.endedAt)} ?`);
      if(!ok) return;
      await deleteMatchFromHistory(id);
      renderStats();
    }

    // Stats dashboard
    function renderStats(){
      const games = state.games;
      const players = state.players;
      const gamesCount = games.length;

      const totalPointsAll = games.reduce((acc,g)=> acc + (g.totals?.reduce((a,b)=>a+b,0) || 0), 0);
      const avgPointsPerGameAll = gamesCount ? Math.round((totalPointsAll / gamesCount) * 10)/10 : 0;
      const lastEnded = gamesCount ? formatDate(games[0].endedAt) : "—";

      const wins = [0,0,0,0];
      const places = {1:[0,0,0,0],2:[0,0,0,0],3:[0,0,0,0],4:[0,0,0,0]};
      const totalPoints = [0,0,0,0];
      const bestSingleRound = [0,0,0,0];
      const bestZeroStreak = [0,0,0,0];

      for(const g of games){
        const tots = g.totals || [0,0,0,0];
        const ranks = g.ranks || ranksFromTotals(tots);
        for(let i=0;i<4;i++){
          totalPoints[i] += tots[i] || 0;
          if(ranks[i] === 1) wins[i] += 1;
          if(places[ranks[i]]) places[ranks[i]][i] += 1;
          bestSingleRound[i] = Math.max(bestSingleRound[i], maxSingleRound(g.rounds, i));
          bestZeroStreak[i] = Math.max(bestZeroStreak[i], longestZeroStreak(g.rounds, i));
        }
      }

      const avgPoints = totalPoints.map(tp => gamesCount ? Math.round((tp/gamesCount)*10)/10 : 0);
      const podiums = [0,0,0,0].map(i => places[1][i] + places[2][i] + places[3][i]);

      function leaderOf(arr, mode="max"){
        if(gamesCount === 0) return {names:"—", value:0, idxs:[]};
        const best = (mode==="min") ? Math.min(...arr) : Math.max(...arr);
        const idxs = arr.map((v,i)=>({v,i})).filter(x => x.v === best).map(x=>x.i);
        return {names: idxs.map(i=>players[i]).join(" / "), value: best, idxs};
      }

      const winLeader = leaderOf(wins, "max");
      const secondLeader = leaderOf(places[2], "max");
      const podiumLeader = leaderOf(podiums, "max");
      const bestSingleLeader = leaderOf(bestSingleRound, "max");
      const zeroStreakLeader = leaderOf(bestZeroStreak, "max");
      const bestAvgLeader = leaderOf(avgPoints, "min");
      const worstAvgLeader = leaderOf(avgPoints, "max");

      // KPI tiles
      kpiEl.innerHTML = "";
      const tiles = [
        {t:"Parties jouées", v: gamesCount, s:"historique (Fin de partie)"},
        {t:"Points cumulés (table)", v: totalPointsAll, s:"tous joueurs confondus"},
        {t:"Moyenne points / partie", v: avgPointsPerGameAll, s:"total table / parties"},
        {t:"Dernière partie", v: lastEnded, s:"date/heure"},
      ];
      for(const it of tiles){
        const d = document.createElement("div");
        d.className = "tile";
        d.innerHTML = `<div class="t">${escapeHtml(it.t)}</div><div class="v">${escapeHtml(it.v)}</div><div class="s">${escapeHtml(it.s)}</div>`;
        kpiEl.appendChild(d);
      }

      // Leaders
      leadersEl.innerHTML = "";
      const leaderLines = [
        {label:"🏆 Le plus de victoires", who: winLeader.names, val: winLeader.value, suffix:"victoire(s)"},
        {label:"🥈 Le plus de 2e places", who: secondLeader.names, val: secondLeader.value, suffix:"fois"},
        {label:"🥉 Le plus de podiums (1‑3)", who: podiumLeader.names, val: podiumLeader.value, suffix:"podium(s)"},
        {label:"📈 Gros score en une manche", who: bestSingleLeader.names, val: bestSingleLeader.value, suffix:"points"},
        {label:"🧊 Série 0 la plus longue", who: zeroStreakLeader.names, val: zeroStreakLeader.value, suffix:"manche(s)"},
        {label:"✅ Meilleure moyenne (plus bas)", who: bestAvgLeader.names, val: bestAvgLeader.value, suffix:"pts/partie"},
        {label:"💥 Pire moyenne (plus haut)", who: worstAvgLeader.names, val: worstAvgLeader.value, suffix:"pts/partie"},
      ];
      leaderLines.forEach(x => {
        const b = document.createElement("div");
        b.className = "rank-item";
        b.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:2px">
            <div style="font-weight:850">${escapeHtml(x.label)}</div>
            <div class="small">${escapeHtml(x.who)}</div>
          </div>
          <div class="pill">${escapeHtml(x.val)} ${escapeHtml(x.suffix)}</div>
        `;
        leadersEl.appendChild(b);
      });

      // Full table
      const table = document.createElement("table");
      table.innerHTML = `
        <thead>
          <tr>
            <th>Joueur</th>
            <th>1er</th>
            <th>2e</th>
            <th>3e</th>
            <th>4e</th>
            <th>Podiums</th>
            <th>Total pts</th>
            <th>Moy. pts/partie</th>
            <th>Meilleure manche (max)</th>
            <th>Meilleure série 0 (max)</th>
          </tr>
        </thead>
        <tbody>
          ${[0,1,2,3].map(i => `
            <tr>
              <td><b>${escapeHtml(players[i])}</b></td>
              <td>${places[1][i]}</td>
              <td>${places[2][i]}</td>
              <td>${places[3][i]}</td>
              <td>${places[4][i]}</td>
              <td><span class="pill">${podiums[i]}</span></td>
              <td><span class="pill">${totalPoints[i]}</span></td>
              <td>${avgPoints[i]}</td>
              <td>${bestSingleRound[i]}</td>
              <td>${bestZeroStreak[i]}</td>
            </tr>
          `).join("")}
        </tbody>
      `;
      statsTableWrap.innerHTML = "";
      const wrap = document.createElement("div");
      wrap.className = "stats-table";
      wrap.appendChild(table);
      statsTableWrap.appendChild(wrap);

      // History
      const hTable = document.createElement("table");
      hTable.innerHTML = `
        <thead>
          <tr>
            <th>Date</th>
            <th>Gagnant</th>
            <th>Totaux</th>
            <th>Manches</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${games.slice(0, 50).map(g => {
            const winners = [0,1,2,3].filter(i => (g.ranks?.[i] ?? 99) === 1).map(i => g.players[i]).join(" / ");
            const totalsLine = g.totals.map((t,i)=> `${g.players[i]}: ${t}`).join(" • ");
            return `
              <tr>
                <td>${escapeHtml(formatDate(g.endedAt))}</td>
                <td><b>${escapeHtml(winners || "—")}</b></td>
                <td class="muted">${escapeHtml(totalsLine)}</td>
                <td>${g.rounds.length}</td>
                <td><button class="btn danger" data-del-game="${g.id}">Supprimer</button></td>
              </tr>
            `;
          }).join("")}
          ${games.length === 0 ? `
            <tr><td colspan="5" class="muted" style="text-align:left;padding:14px">Aucune partie archivée pour l’instant. Terminez une partie via <b>Fin de partie</b> pour alimenter les stats.</td></tr>
          ` : ""}
        </tbody>
      `;
      historyWrap.innerHTML = "";
      const hWrap = document.createElement("div");
      hWrap.className = "stats-table";
      hWrap.appendChild(hTable);
      historyWrap.appendChild(hWrap);
    }

    // Bindings
    addRoundBtn.addEventListener("click", () => addRound().catch((err) => {
      console.error("add_round_failed", err);
    }));
    undoBtn.addEventListener("click", () => undoRound().catch((err) => {
      console.error("undo_round_failed", err);
    }));
    newGameBtn.addEventListener("click", () => newGame().catch((err) => {
      console.error("new_game_failed", err);
    }));
    endGameBtn.addEventListener("click", () => endGame().catch((err) => {
      console.error("end_game_failed", err);
    }));

    exportBtn.addEventListener("click", exportJSON);
    importBtn.addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", (e) => {
      const f = e.target.files?.[0];
      if(f) importJSONFile(f);
      importFile.value = "";
    });

    nameInputs.forEach((inp, i) => {
      inp.addEventListener("input", () => {
        state.players[i] = (inp.value || "").trim() || DEFAULT_STATE.players[i];
        render();
        schedulePlayersUpdate();
      });
    });

    targetInput.addEventListener("input", () => {
      const v = clampInt(targetInput.value);
      state.target = (v && v > 0) ? v : 66;
      renderTotalsAndRanking();
      scheduleTargetUpdate();
    });

    rankingEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-add-points]");
      if(!btn) return;
      const pi = Number(btn.getAttribute("data-add-points"));
      if(Number.isFinite(pi)) openAddPoints(pi).catch((err) => {
        console.error("open_add_points_failed", err);
      });
    });

    historyWrap.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-del-game]");
      if(!btn) return;
      const id = btn.getAttribute("data-del-game");
      if(id) deleteGame(id).catch((err) => {
        console.error("delete_game_failed", err);
      });
    });

    document.addEventListener("keydown", (e) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if(mod && e.key.toLowerCase() === "z"){
        e.preventDefault();
        undoRound().catch((err) => {
          console.error("undo_round_failed", err);
        });
      }
    });

    bootstrap().catch((err) => {
      console.error("bootstrap_failed", err);
      render();
    });
