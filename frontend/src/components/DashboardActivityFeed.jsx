import { useEffect, useState } from 'react';
import axios from 'axios';
import UserAvatar from './UserAvatar';
import { formatRelativeTime } from '../utils/relativeTime';

const CATEGORY_TONES = {
  Ticket: 'ticket',
  Tarea: 'task',
  Reunión: 'meeting',
  Minuta: 'minute',
  Aviso: 'aviso',
  Foro: 'forum',
  Knowledge: 'knowledge',
  Usuario: 'user',
};

function CategoryBadge({ category }) {
  const tone = CATEGORY_TONES[category] || 'default';
  return (
    <span className={`dashboard-activity__badge dashboard-activity__badge--${tone}`}>
      {category}
    </span>
  );
}

export default function DashboardActivityFeed({ onOpenItem }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = async () => {
    try {
      const { data } = await axios.get('/api/activity/recent', { params: { limit: 30 } });
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="dashboard-activity rounded-sm border border-gray-200 bg-white shadow-sm">
      <header className="dashboard-activity__header">
        <div>
          <p className="font-sans font-bold text-navy-950 text-sm tracking-wide">Actividad reciente</p>
          <p className="font-sans text-navy-500 text-xs mt-0.5">Todo lo que ocurre en BOSA Hub</p>
        </div>
        <button
          type="button"
          onClick={fetchActivity}
          className="dashboard-activity__refresh"
          aria-label="Actualizar actividad"
        >
          Actualizar
        </button>
      </header>

      {loading ? (
        <div className="dashboard-activity__loading">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="dashboard-activity__empty">
          <p className="text-sm font-semibold text-navy-800">Sin actividad registrada</p>
          <p className="mt-1 text-xs text-navy-500">Los movimientos del sistema aparecerán aquí.</p>
        </div>
      ) : (
        <ol className="dashboard-activity__timeline">
          {items.map((item, index) => {
            const clickable = Boolean(onOpenItem && item.module);
            return (
              <li key={item.id} className="dashboard-activity__item">
                <div className="dashboard-activity__rail" aria-hidden>
                  {index < items.length - 1 ? <span className="dashboard-activity__line" /> : null}
                </div>
                <UserAvatar
                  name={item.actor?.name}
                  apellido={item.actor?.apellido}
                  avatarUrl={item.actor?.avatar_url}
                  size="sm"
                  className="dashboard-activity__avatar"
                />
                <div className="dashboard-activity__body min-w-0">
                  {item.category ? <CategoryBadge category={item.category} /> : null}
                  <p className="dashboard-activity__text">
                    <span className="dashboard-activity__actor">{item.actor_name}</span>{' '}
                    <span className="dashboard-activity__detail">{item.detail}</span>
                  </p>
                  {item.reference ? (
                    clickable ? (
                      <button
                        type="button"
                        onClick={() => onOpenItem(item)}
                        className="dashboard-activity__reference dashboard-activity__reference--link"
                      >
                        {item.reference}
                      </button>
                    ) : (
                      <p className="dashboard-activity__reference">{item.reference}</p>
                    )
                  ) : null}
                  <time className="dashboard-activity__time" dateTime={item.occurred_at}>
                    {formatRelativeTime(item.occurred_at)}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
