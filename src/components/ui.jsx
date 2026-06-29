import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { HelpCircle } from 'lucide-react';
import '../index.css';

export const Tooltip = ({ label, text }) => (
  <span className="tooltip-wrap" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
    {label} {text && <HelpCircle size={14} style={{ color: 'var(--text-muted)' }} />}
    {text && <span className="tooltip-content">{text}</span>}
  </span>
);

export const SliderInput = ({ value, onChange, min, max, step }) => (
  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', width: '100%' }}>
    <div style={{ flex: 1, padding: '0 8px' }}>
      <Slider min={min} max={max} step={step} value={value} onChange={onChange} />
    </div>
    <input 
      type="number" 
      step={step} 
      value={value} 
      onChange={e => onChange(Number(e.target.value))} 
      style={{ width: '90px', padding: '8px', fontSize: '1rem', boxShadow: 'none' }}
    />
  </div>
);
