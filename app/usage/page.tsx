"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ApiUsageRow, listApiUsage } from "@/lib/api-usage";

const operationLabels: Record<ApiUsageRow["operation"], string> = {
  candidate: "候補選定",
  detail: "詳細レシピ",
  image: "完成写真",
};

const menuLabels: Record<ApiUsageRow["menu_kind"], string> = {
  bento: "弁当",
  izakaya: "居酒屋",
};

function yen(value: number) {
  return new Intl.NumberFormat("ja-JP", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export default function ApiUsagePage() {
  const [records, setRecords] = useState<ApiUsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    listApiUsage()
      .then((items) => { if (active) setRecords(items); })
      .catch(() => { if (active) setError("費用履歴を読み込めませんでした。時間をおいて再度お試しください。"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const summary = useMemo(() => {
    const byOperation = { candidate: 0, detail: 0, image: 0 };
    let jpy = 0;
    let usd = 0;
    records.forEach((record) => {
      const recordJpy = Number(record.estimated_cost_jpy) || 0;
      jpy += recordJpy;
      usd += Number(record.estimated_cost_usd) || 0;
      byOperation[record.operation] += recordJpy;
    });
    return { jpy, usd, byOperation };
  }, [records]);

  return <main className="saved-page usage-page">
    <header className="planner-header">
      <Link className="back" href="/">← トップへ戻る</Link>
      <Link className="library-link" href="/saved">保存したメニュー</Link>
    </header>
    <section className="saved-hero">
      <p className="eyebrow">OPENAI API COST LOG</p>
      <h1>API費用の記録</h1>
      <p>候補選定、詳細レシピ、完成写真を生成するたびに、APIが返した使用量から費用を記録します。</p>
      <p className="guest-note">金額はOpenAIの公開単価と設定為替レートによる概算です。請求確定額はOpenAIの利用明細を確認してください。</p>
    </section>
    <section className="saved-content" aria-busy={loading}>
      {loading && <div className="library-state" role="status"><span className="progress-spinner" aria-hidden="true" /><b>費用履歴を読み込んでいます</b></div>}
      {error && <div className="library-state error" role="alert"><b>{error}</b><button type="button" onClick={() => window.location.reload()}>再読み込み</button></div>}
      {!loading && !error && <>
        <div className="usage-summary">
          <article className="usage-total"><span>累計概算</span><strong>約{yen(summary.jpy)}円</strong><small>${summary.usd.toFixed(4)}・{records.length}回</small></article>
          {(["candidate", "detail", "image"] as const).map((operation) => <article key={operation}><span>{operationLabels[operation]}</span><strong>{yen(summary.byOperation[operation])}円</strong></article>)}
        </div>
        <details className="usage-basis">
          <summary>計算方法と注意事項</summary>
          <p>テキストは各応答の入力・キャッシュ書込み・キャッシュ入力・出力トークンを、実際のモデルと処理tierに対応する公開単価で計算します。候補はGPT-5.6 Luna、詳細はGPT-5.6 Terraを使用します。画像はAPIが使用量を返す場合はそのトークン数を使い、返さない場合はGPT Image 2の1024×1024・low公式見積（画像出力1枚 $0.006、入力費用は別途）を使います。</p>
          <p>円換算は各記録時点の設定値を使用します。初期値は1ドル160円で、環境変数 <code>OPENAI_COST_USD_JPY_RATE</code> から変更できます。</p>
          <a href="https://developers.openai.com/api/docs/pricing" target="_blank" rel="noreferrer">OpenAI公式料金表を見る ↗</a>
        </details>
        {records.length === 0 ? <div className="library-empty"><span aria-hidden="true">¥</span><h2>まだ費用記録はありません</h2><p>弁当または居酒屋メニューを生成すると、ここに記録されます。</p><div><Link href="/bento">弁当を考える</Link><Link href="/izakaya">居酒屋メニューを考える</Link></div></div> :
          <div className="usage-table-wrap">
            <table className="usage-table">
              <thead><tr><th>日時</th><th>用途</th><th>モデル</th><th>トークン</th><th>概算費用</th></tr></thead>
              <tbody>{records.map((record) => <tr key={record.id}>
                <td><time dateTime={record.created_at}>{new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.created_at))}</time></td>
                <td><b>{menuLabels[record.menu_kind]}・{operationLabels[record.operation]}</b>{record.is_estimate && <small>公式見積で計算</small>}</td>
                <td>{record.model}<small>{record.service_tier}</small></td>
                <td><span>入力 {Number(record.input_tokens).toLocaleString()}</span><small>キャッシュ {Number(record.cached_input_tokens).toLocaleString()} / 出力 {Number(record.output_tokens).toLocaleString()}</small></td>
                <td><strong>{yen(Number(record.estimated_cost_jpy))}円</strong><small>${Number(record.estimated_cost_usd).toFixed(6)} @ ¥{Number(record.usd_jpy_rate)}</small></td>
              </tr>)}</tbody>
            </table>
          </div>}
      </>}
    </section>
  </main>;
}
