/* Email version of the 7-day healing arc (same chart as the app and the quiz page).
   Plain tables and solid colours so it holds up in Gmail, Apple Mail and Outlook. */
(function (G) {
  var PH = { prep: "#d4925f", fast: "#2c4436", r2: "#6f9ce8", r3: "#5a88d8", normal: "#9480b4" };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function arcEmail(r, INK, MUT, LINE) {
    var I = r.arcInfo, chip = I.lvl === 1 ? ["#e3eedd", "#4d6b45"] : ["#f6e7c8", "#8a6420"], CT = INK, CM = MUT, CG = MUT;
    var bars = r.arc.map(function (d) {
      var h = Math.max(8, Math.round(d.p / 100 * 110));
      return '<td valign="bottom" align="center" style="padding:0 2px;height:165px">' +
        '<div style="font-family:Georgia,serif;font-size:13px;color:' + CG + '">' + d.p + '%</div>' +
        '<div style="font-size:9px;color:' + CM + ';margin-bottom:4px;white-space:nowrap">' + d.kcal.toLocaleString("en-US") + ' kcal</div>' +
        '<div style="height:' + h + 'px;line-height:' + h + 'px;font-size:0;background:' + PH[d.ph] + ';border-radius:5px 5px 0 0">&nbsp;</div></td>';
    }).join("");
    var labels = r.arc.map(function (d) { return '<td align="center" valign="top" style="padding:6px 1px 0;font-size:9px;color:' + CM + ';text-transform:uppercase;line-height:1.15">' + esc(d.l) + "</td>"; }).join("");
    var legend = I.legend.map(function (x) { return '<span style="white-space:nowrap;margin-right:12px"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:' + PH[x[0]] + ';vertical-align:middle"></span>&nbsp;' + esc(x[1]) + "</span>"; }).join(" ");
    var days = r.arc.map(function (d) {
      return '<tr><td valign="top" style="width:18px;padding:9px 0 0"><div style="width:10px;height:10px;border-radius:3px;background:' + PH[d.ph] + ';font-size:0;line-height:0">&nbsp;</div></td>' +
        '<td style="padding:6px 0;font-size:14px;line-height:1.4"><b style="color:' + INK + '">' + esc(d.t) + '</b><br><span style="color:' + MUT + '">' + esc(d.n) + "</span></td></tr>";
    }).join("");
    return '<div style="border:1px solid ' + LINE + ';border-radius:14px;background:#ffffff;padding:16px 12px 12px">' +
      '<div style="font-family:Georgia,serif;font-size:18px;line-height:1.3;color:' + CT + '">' + I.emoji + " Level " + I.lvl + " &middot; " + esc(I.name) + " &mdash; 7-Day Arc " +
        '<span style="font-family:Helvetica,Arial,sans-serif;font-size:10px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;background:' + chip[0] + ";color:" + chip[1] + ';border-radius:999px;padding:3px 8px;white-space:nowrap">' + esc(I.diff) + "</span></div>" +
      '<p style="font-size:12px;color:' + CM + ';line-height:1.5;margin:6px 0 14px">' + esc(I.sub) + "</p>" +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;border-bottom:1px solid ' + LINE + '"><tr>' + bars + "</tr></table>" +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr>' + labels + "</tr></table>" +
      '<p style="font-size:11px;color:' + CM + ';line-height:1.8;margin:10px 0 0">' + legend + "</p></div>" +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">' + days + "</table>";
  }
  G.MTHArcEmail = arcEmail;
})(typeof window !== "undefined" ? window : globalThis);
