export default function GameScoreList({ scores }) {
  return <ul className="stacked-game-scores">{Array.from({length:6},(_,index) => {
    const level=index+1;
    const score=scores.filter((item) => Number(item.level)===level).sort((a,b) => new Date(b.recorded_at || b.recordedAt || 0)-new Date(a.recorded_at || a.recordedAt || 0))[0];
    return <li key={level}><strong>Level {level}</strong><span>{score ? `${score.score}/${score.max_score ?? score.maxScore}` : 'No score yet'}</span></li>;
  })}</ul>;
}
