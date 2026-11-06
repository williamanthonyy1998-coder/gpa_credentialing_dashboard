import {
  Activity, Building2, CheckSquare, ClipboardCheck, CreditCard, FileText,
  Gauge, Landmark, MapPin, ShieldCheck, Stethoscope, Users
} from 'lucide-react';

export const ICONS = {
  Activity, Building2, CheckSquare, ClipboardCheck, CreditCard, FileText,
  Gauge, Landmark, MapPin, ShieldCheck, Stethoscope, Users
};

export function resolveIcon(name) {
  return ICONS[name] || Gauge;
}
