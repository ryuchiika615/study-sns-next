"use client";

export default function SurveyPopup({
  activeSurvey,
  surveyResponse,
  surveyResults,
  selectedOption,
  customReply,
  surveySubmitting,
  readOnly,
  onSelectOption,
  onCustomReplyChange,
  onSubmit,
  onDismiss,
  onClose,
}: {
  activeSurvey: any;
  surveyResponse: any;
  surveyResults: any;
  selectedOption: string;
  customReply: string;
  surveySubmitting: boolean;
  readOnly?: boolean;
  onSelectOption: (opt: string) => void;
  onCustomReplyChange: (v: string) => void;
  onSubmit: () => Promise<void>;
  onDismiss: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onDismiss}>
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-base">📊 アンケート</h3>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${activeSurvey.anonymous ? "bg-gray-100 text-gray-500" : "bg-blue-50 text-blue-600"}`}>
              {activeSurvey.anonymous ? "匿名" : "公開"}
            </span>
            <button onClick={onClose}
              className="text-gray-500 text-xl cursor-pointer">
              <i className="fas fa-times" />
            </button>
          </div>
        </div>
        <p className="font-bold text-sm mb-3">{activeSurvey.question}</p>

        {!surveyResponse && !readOnly ? (
          <>
            <p className="text-xs text-gray-500 mb-3">回答よろしくお願いします！</p>
            <div className="space-y-2 mb-4">
              {activeSurvey.options?.map((opt: string) => (
                <label key={opt}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-sm cursor-pointer transition ${selectedOption === opt ? 'border-primary bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="survey-option" value={opt} checked={selectedOption === opt}
                    onChange={() => onSelectOption(opt)} className="cursor-pointer" />
                  {opt}
                </label>
              ))}
            </div>
            {activeSurvey.allow_custom !== false && (
              <textarea value={customReply} onChange={(e) => onCustomReplyChange(e.target.value)}
                placeholder="自由に返信（任意）"
                className="w-full rounded-lg border-gray-300 text-sm mb-4" rows={2} />
            )}
            <button onClick={onSubmit} disabled={!selectedOption || surveySubmitting}
              className="w-full bg-primary text-white font-bold rounded-full py-2 text-sm cursor-pointer disabled:opacity-50">
              {surveySubmitting ? "送信中..." : "回答する"}
            </button>
            <p className="text-[10px] text-gray-400 text-center mt-2">閉じるを押すと後で回答できます</p>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-3">集計結果（{surveyResults?.total || 0}件の回答）</p>
            {activeSurvey.options?.map((opt: string) => {
              const count = surveyResults?.counts?.[opt] || 0;
              const pct = surveyResults?.total > 0 ? Math.round((count / surveyResults.total) * 100) : 0;
              const isMyVote = surveyResponse?.selected_option === opt;
              return (
                <div key={opt} className={`mb-2 p-2 rounded-lg ${isMyVote ? "bg-blue-50 border border-blue-200" : ""}`}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className={isMyVote ? "font-bold text-primary" : ""}>
                      {opt} {isMyVote && "✓"}
                    </span>
                    <span className="text-gray-500">{count}票 ({pct}%)</span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  {!activeSurvey.anonymous && surveyResults?.voters?.[opt]?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {surveyResults.voters[opt].map((v: any, i: number) => (
                        <span key={i} className="text-[10px] bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded">
                          {v.display_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {surveyResults?.customs?.length > 0 && (
              <div className="mt-2 border-t border-gray-100 pt-2">
                <p className="text-xs font-bold text-gray-500 mb-1">返信:</p>
                {surveyResults.customs.map((c: any, i: number) => (
                  <p key={i} className="text-xs text-gray-600 bg-gray-50 rounded p-1.5 mb-1">
                    {!activeSurvey.anonymous && c.user && <span className="font-medium">{c.user.display_name}: </span>}
                    「{c.option}」 {c.reply}
                  </p>
                ))}
              </div>
            )}
            <button onClick={onClose}
              className="w-full mt-3 bg-gray-200 text-gray-600 font-bold rounded-full py-2 text-sm cursor-pointer hover:bg-gray-300 transition">
              閉じる
            </button>
          </>
        )}
      </div>
    </div>
  );
}
