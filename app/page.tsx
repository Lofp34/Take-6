"use client";

import Script from "next/script";

const markup = `
<div class="wrap">
  <header>
    <div class="title">
      <h1>6 qui prend ! — Score + Tableau de stats</h1>
      <div class="sub">
        Saisissez les <b>points de pénalité</b> par manche. <b>Le plus petit total gagne.</b><br/>
        ✅ Fin automatique à 66 • ✅ Ajout sécurisé par pop‑up • ✅ Historique des parties
      </div>
    </div>

    <div class="toolbar">
      <button class="primary" id="addRoundBtn">+ Ajouter une manche</button>
      <button class="primary" id="endGameBtn" title="Archive la partie dans l'historique et remet le score à zéro">Fin de partie (manuel)</button>
      <button id="undoBtn" class="ghost" title="Annule la dernière manche">Annuler</button>
      <button id="resetBoardBtn" class="ghost" title="Remet tous les scores a zero pour la partie en cours">Remettre a zero</button>
      <button id="exportBtn">Exporter</button>
      <button id="importBtn">Importer</button>
      <button class="danger" id="newGameBtn">Nouvelle partie</button>
      <input class="file" id="importFile" type="file" accept="application/json" />
    </div>
  </header>

  <div class="grid">
    <div class="card">
      <h2>Tableau des manches</h2>
      <div class="scores" role="region" aria-label="Tableau des scores">
        <table id="scoreTable">
          <thead>
            <tr id="theadRow">
              <th>Manche</th>
            </tr>
          </thead>
          <tbody id="tbody"></tbody>
          <tfoot>
            <tr class="totals" id="totalsRow">
              <td>Total</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="footer">
        Rappel : la partie s'arrête à la fin d'une manche dès que quelqu’un atteint <b>66</b> points (ou plus), puis le plus petit total gagne.
      </div>
    </div>

    <div class="right">
      <div class="card">
        <h2>Joueurs</h2>
        <div class="row">
          <label for="p0">J1</label><input id="p0" type="text" />
          <label for="p1">J2</label><input id="p1" type="text" />
        </div>
        <div class="row" style="margin-top:10px">
          <label for="p2">J3</label><input id="p2" type="text" />
          <label for="p3">J4</label><input id="p3" type="text" />
        </div>
        <div class="hint">Vous pouvez renommer les joueurs à tout moment. Tout se met à jour automatiquement.</div>

        <div class="divider"></div>

        <div class="row">
          <label for="target">Seuil (fin de partie)</label>
          <input id="target" type="number" min="1" step="1" />
          <span class="small">défaut : 66</span>
        </div>
        <div class="hint">
          Indicateurs : <span class="badge"><span class="dot good"></span>Leader</span>
          <span class="badge"><span class="dot bad"></span>Seuil atteint</span>
        </div>
      </div>

      <div class="card">
        <h2>Classement (total le plus faible)</h2>
        <div id="statusBadges" style="margin-bottom:10px"></div>
        <div class="rank" id="ranking"></div>
        <div class="hint" id="winnerHint"></div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>Statistiques (multi‑parties)</h2>
    <div class="hint" style="margin-top:0;margin-bottom:10px">
      Les stats se mettent à jour à la fin d’une partie (clôture automatique à 66, ou bouton <b>Fin de partie (manuel)</b>).
    </div>

    <div class="kpi" id="kpi"></div>

    <div class="stats-grid">
      <div class="card">
        <h2>Leaders</h2>
        <div id="leaders"></div>
        <div class="hint">
          Définitions :<br/>
          • <b>“Gros score en une manche”</b> = maximum de points pris par un joueur sur une manche (tel que saisi).<br/>
          • <b>“Série 0”</b> = plus longue série de manches consécutives à <b>0 point</b> (zéro strict) dans une partie archivée.
        </div>
      </div>

      <div class="card">
        <h2>Tableau complet</h2>
        <div class="stats-table" id="statsTableWrap"></div>
      </div>

      <div class="card full">
        <h2>Historique des parties</h2>
        <div class="hint" style="margin-top:0;margin-bottom:10px">Astuce : vous pouvez supprimer une partie de l’historique si besoin.</div>
        <div class="stats-table" id="historyWrap"></div>
      </div>
    </div>
  </div>
</div>

<!-- Modal: ajout de points -->
<dialog id="addPointsDialog" style="border:none;background:transparent;padding:0;max-width:520px;width:92vw;">
  <form method="dialog" id="addPointsForm" class="card" style="margin:0;">
    <h2 style="margin-bottom:6px">Ajouter des points</h2>
    <div class="sub" id="addPointsSubtitle" style="margin-bottom:12px"></div>

    <div class="row" style="margin-bottom:10px">
      <label for="addPointsValue">Points à ajouter</label>
      <input id="addPointsValue" type="number" min="0" step="1" inputmode="numeric" style="width:170px" placeholder="ex: 5" />
      <span class="small">ajoute à la dernière manche</span>
    </div>

    <div class="row" style="gap:8px;margin-bottom:12px">
      <button type="button" class="btn" data-quick="1">+1</button>
      <button type="button" class="btn" data-quick="2">+2</button>
      <button type="button" class="btn" data-quick="3">+3</button>
      <button type="button" class="btn" data-quick="5">+5</button>
      <button type="button" class="btn" data-quick="7">+7</button>
      <button type="button" class="btn" data-quick="10">+10</button>
      <button type="button" class="btn" id="addPointsClear">Effacer</button>
    </div>

    <div class="divider"></div>

    <div class="row" style="justify-content:flex-end">
      <button value="cancel" class="ghost" type="button" id="addPointsCancel">Annuler</button>
      <button value="ok" class="primary" id="addPointsOk" type="submit">Ajouter</button>
    </div>

    <div class="hint" style="margin-top:10px">
      Ça incrémente la <b>dernière manche</b> (ou en crée une si besoin) pour éviter d’écraser des valeurs.
    </div>
  </form>
</dialog>
`;

export default function Home() {
  return (
    <>
      <main
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: markup }}
      />
      <Script src="/app.js" strategy="afterInteractive" />
    </>
  );
}
