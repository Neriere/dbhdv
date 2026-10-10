import { PriceProfile } from '../../types';

export interface MarketSnifferModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProfile?: PriceProfile;
  onPriceUpdated?: () => void;
}

export const PRESET_SERVERS = [
  { name: 'Draconiros', category: 'Monocuenta Clásico' },
  { name: 'Kourial', category: 'Monocuenta Pionero' },
  { name: 'Mikhal', category: 'Monocuenta Pionero' },
  { name: 'Dakal', category: 'Monocuenta Pionero' },
  { name: 'Brial', category: 'Multicuenta Pionero' },
  { name: 'Rafal', category: 'Multicuenta Pionero' },
  { name: 'Salar', category: 'Multicuenta Pionero' },
  { name: 'Tal Kasha', category: 'Multicuenta Clásico' },
  { name: 'Hell Mina', category: 'Multicuenta Clásico' },
  { name: 'Imagiro', category: 'Multicuenta Clásico' },
  { name: 'Orukam', category: 'Multicuenta Clásico' },
  { name: 'Tylezia', category: 'Multicuenta Clásico' },
  { name: 'Shadow', category: 'Sombra (Épico)' },
];
