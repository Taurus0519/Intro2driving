import { useEffect, useState } from 'react';
import { supabase } from './supabase_Client';
import { useAuth } from './useAunth';
import { ACHIEVEMENTS } from '../js/achievementData';
import StudentPicker from './StudentPicker';
import '../css/Achievements.css';

export default function Achievements() {
  const { profile, user } = useAuth();
  const isSuperAdmin = profile?.role === 'superadmin';
  const [students, setStudents] = useState([]);
  const [awards, setAwards] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyAchievementId, setBusyAchievementId] = useState('');

  async function loadAwards() {
    let query = supabase
      .from('player_achievements')
      .select('user_id, achievement_id, unlocked_at')
      .order('unlocked_at', { ascending: false });

    if (!isSuperAdmin) query = query.eq('user_id', user.id);

    const { data, error: awardsError } = await query;
    if (awardsError) {
      setError(awardsError.message);
      setLoadFailed(true);
      return;
    }
    setLoadFailed(false);
    setAwards(data || []);
  }

  useEffect(() => {
    let active = true;

    async function loadPage() {
      setLoading(true);
      setError('');
      setLoadFailed(false);
      const awardsQuery = supabase
        .from('player_achievements')
        .select('user_id, achievement_id, unlocked_at')
        .order('unlocked_at', { ascending: false });
      const results = await Promise.all([
        isSuperAdmin ? awardsQuery : awardsQuery.eq('user_id', user.id),
        isSuperAdmin
          ? supabase.from('profiles').select('id, name').eq('role', 'student').order('name')
          : Promise.resolve({ data: [], error: null }),
      ]);
      const [awardsResult, studentsResult] = results;

      if (!active) return;
      if (awardsResult.error || studentsResult.error) {
        setError(awardsResult.error?.message || studentsResult.error?.message);
        setLoadFailed(true);
      } else {
        setAwards(awardsResult.data || []);
        setStudents(studentsResult.data || []);
      }
      setLoading(false);
    }

    void loadPage();
    return () => {
      active = false;
    };
  }, [isSuperAdmin, user.id]);

  async function toggleAchievement(achievementId, isUnlocked) {
    if (!studentId) return;

    setBusyAchievementId(achievementId);
    setError('');
    const result = isUnlocked
      ? await supabase
        .from('player_achievements')
        .delete()
        .eq('user_id', studentId)
        .eq('achievement_id', achievementId)
      : await supabase
        .from('player_achievements')
        .insert({ user_id: studentId, achievement_id: achievementId });

    if (result.error) {
      setError(result.error.message);
    } else {
      await loadAwards();
    }
    setBusyAchievementId('');
  }

  const visibleAwards = isSuperAdmin
    ? awards.filter((award) => award.user_id === studentId)
    : awards;
  const latestAward = visibleAwards[0];
  const latestAchievement = ACHIEVEMENTS.find((item) => item.id === latestAward?.achievement_id);
  const studentName = students.find((student) => student.id === studentId)?.name;

  return (
    <div className="achievements-page">
      <section className="achievement-latest">
        <h3>{isSuperAdmin && studentName ? `Latest for ${studentName}` : 'Latest Achievement'}</h3>
        <div>
          {latestAchievement ? latestAchievement.title : 'No achievement unlocked yet'}
        </div>
      </section>

      {isSuperAdmin && (
        <StudentPicker
          id="achievement-student-select"
          className="award-select"
          label="View achievements for student"
          students={students}
          value={studentId}
          onChange={setStudentId}
        />
      )}

      <h3>{isSuperAdmin ? 'Student Achievements' : 'Your Achievements'}</h3>
      {error && <p className="error" role="alert">{error}</p>}
      {loading ? (
        <p>Loading achievements...</p>
      ) : loadFailed ? null : (
        <div className="achievement-list">
          {ACHIEVEMENTS.map((achievement) => {
            const award = visibleAwards.find((item) => item.achievement_id === achievement.id);
            const isUnlocked = Boolean(award);

            return (
              <article key={achievement.id} className={`achievement-row${isUnlocked ? ' is-unlocked' : ''}`}>
                <div className="achievement-details">
                  <strong>{achievement.title}</strong>
                  <p>{achievement.description}</p>
                  {award && (
                    <small>Completed {new Date(award.unlocked_at).toLocaleDateString()}</small>
                  )}
                </div>
                <span className={`achievement-status${isUnlocked ? ' is-unlocked' : ''}`}>
                  {isUnlocked ? 'Completed' : 'Not completed'}
                </span>
                {isSuperAdmin && (
                  <div className="achievement-actions">
                    <button
                      type="button"
                      disabled={!studentId || busyAchievementId === achievement.id}
                      onClick={() => toggleAchievement(achievement.id, isUnlocked)}
                    >
                      {busyAchievementId === achievement.id
                        ? 'Saving...'
                        : isUnlocked ? 'Revoke' : 'Mark complete'}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
