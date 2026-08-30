import { useNavigate } from 'react-router-dom';

const GROUP = {
  spouse: 'family',
  partner: 'family',
  ex: 'family',
  sibling: 'family',
  parent: 'family',
  child: 'family',
  grandparent: 'family',
  grandchild: 'family',
  relative: 'family',
  colleague: 'work',
  manager: 'work',
  report: 'work',
  friend: 'social',
};
const COLOR = {
  family: '#fb7185', // rose-400
  work: '#38bdf8', // sky-400
  social: '#34d399', // emerald-400
  other: '#94a3b8', // slate-400
};
const groupOf = (type) => GROUP[type] || 'other';

function short(name, n = 14) {
  return name.length > n ? `${name.slice(0, n - 1)}…` : name;
}

/**
 * Radial one-hop map: the person in the centre, their direct links around them.
 * Tap a node to open that person (which re-centres the map on them).
 */
export default function RelationshipMap({ person }) {
  const navigate = useNavigate();
  const links = (person.relationships || []).slice(0, 12);
  if (links.length < 2) return null;

  const W = 320;
  const H = 300;
  const cx = W / 2;
  const cy = H / 2;
  const R = 108;

  const nodes = links.map((l, i) => {
    const angle = (i / links.length) * 2 * Math.PI - Math.PI / 2;
    return {
      ...l,
      x: cx + R * Math.cos(angle),
      y: cy + R * Math.sin(angle),
      color: COLOR[groupOf(l.type)],
    };
  });

  const groupsShown = [...new Set(nodes.map((n) => groupOf(n.type)))];

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mx-auto block h-[280px] w-full max-w-[340px]"
        role="img"
        aria-label={`Relationship map for ${person.name}`}
      >
        {nodes.map((n) => (
          <line
            key={`e-${n.id}`}
            x1={cx}
            y1={cy}
            x2={n.x}
            y2={n.y}
            stroke={n.color}
            strokeOpacity="0.35"
            strokeWidth="1.5"
          />
        ))}

        {nodes.map((n) => {
          const mx = cx + (n.x - cx) * 0.52;
          const my = cy + (n.y - cy) * 0.52;
          return (
            <text
              key={`l-${n.id}`}
              x={mx}
              y={my}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-slate-500"
              style={{ fontSize: 9 }}
            >
              {n.type}
            </text>
          );
        })}

        {/* neighbours */}
        {nodes.map((n) => (
          <g
            key={n.id}
            onClick={() => navigate(`/people/${n.person.id}`)}
            style={{ cursor: 'pointer' }}
          >
            <title>{`${n.person.name} — ${n.type}`}</title>
            <circle cx={n.x} cy={n.y} r="17" fill="#0f172a" stroke={n.color} strokeWidth="2" />
            <text
              x={n.x}
              y={n.y + 30}
              textAnchor="middle"
              className="fill-slate-300"
              style={{ fontSize: 10 }}
            >
              {short(n.person.name, 12)}
            </text>
          </g>
        ))}

        {/* centre */}
        <circle cx={cx} cy={cy} r="22" fill="#312e81" stroke="#818cf8" strokeWidth="2" />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-slate-100"
          style={{ fontSize: 10, fontWeight: 600 }}
        >
          {short(person.name.split(' ')[0], 10)}
        </text>
      </svg>

      {groupsShown.length > 1 && (
        <div className="mt-1 flex justify-center gap-3 text-[10px] text-slate-500">
          {groupsShown.map((g) => (
            <span key={g} className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: COLOR[g] }}
              />
              {g}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
