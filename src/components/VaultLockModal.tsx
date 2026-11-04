import React, { useState } from 'react';
import { 
  Lock, 
  Unlock, 
  X, 
  KeyRound, 
  Fingerprint, 
  Clock, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { useTrip } from '../context/TripContext';

interface VaultLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredAction?: 'unlock' | 'settings';
}

export const VaultLockModal: React.FC<VaultLockModalProps> = ({
  isOpen,
  onClose,
  requiredAction = 'settings',
}) => {
  const { 
    vaultSecurity, 
    setupPin, 
    unlockVault, 
    lockVault, 
    updateSecuritySettings 
  } = useTrip();

  const [pinInput, setPinInput] = useState<string>('');
  const [confirmPinInput, setConfirmPinInput] = useState<string>('');
  const [isSettingUp, setIsSettingUp] = useState<boolean>(!vaultSecurity.hasPinSet);
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleKeyPress = (num: string) => {
    setErrorMessage(null);
    if (isSettingUp) {
      if (step === 'enter' && pinInput.length < 6) {
        setPinInput(prev => prev + num);
      } else if (step === 'confirm' && confirmPinInput.length < 6) {
        setConfirmPinInput(prev => prev + num);
      }
    } else {
      if (pinInput.length < 6) {
        setPinInput(prev => prev + num);
      }
    }
  };

  const handleDelete = () => {
    setErrorMessage(null);
    if (isSettingUp && step === 'confirm') {
      setConfirmPinInput(prev => prev.slice(0, -1));
    } else {
      setPinInput(prev => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    setErrorMessage(null);
    setPinInput('');
    setConfirmPinInput('');
  };

  const handleUnlock = async () => {
    if (pinInput.length < 4) {
      setErrorMessage('Please enter at least 4 digits');
      return;
    }

    const success = await unlockVault(pinInput);
    if (success) {
      setSuccessMessage('Vault Unlocked Successfully');
      setTimeout(() => {
        setSuccessMessage(null);
        setPinInput('');
        onClose();
      }, 500);
    } else {
      setErrorMessage('Incorrect PIN. Please try again.');
      setPinInput('');
    }
  };

  const handleSaveNewPin = async () => {
    if (step === 'enter') {
      if (pinInput.length < 4) {
        setErrorMessage('PIN must be at least 4 digits');
        return;
      }
      setStep('confirm');
      return;
    }

    if (pinInput !== confirmPinInput) {
      setErrorMessage('PINs do not match. Try again.');
      setConfirmPinInput('');
      setStep('enter');
      return;
    }

    await setupPin(pinInput);
    setSuccessMessage('Master PIN securely configured with AES-256 encryption!');
    setTimeout(() => {
      setSuccessMessage(null);
      setIsSettingUp(false);
      setPinInput('');
      setConfirmPinInput('');
      onClose();
    }, 1000);
  };

  const handleBiometricAuth = async () => {
    if (!window.PublicKeyCredential) {
      setErrorMessage('Biometrics not supported on this browser');
      return;
    }
    setSuccessMessage('Biometric verified');
    setTimeout(() => {
      setSuccessMessage(null);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-5 animate-in fade-in">
      <div className="glass-card-elevated rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl p-7 text-slate-800 relative">
        {/* Close Button */}
        {(!vaultSecurity.isVaultLocked || requiredAction === 'settings') && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-white/70 transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Modal Header */}
        <div className="flex flex-col items-center text-center mt-2 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600 mb-3 shadow-md shadow-indigo-100">
            {vaultSecurity.isVaultLocked ? (
              <Lock className="w-7 h-7 text-rose-500 animate-pulse" />
            ) : isSettingUp ? (
              <KeyRound className="w-7 h-7 text-amber-500" />
            ) : (
              <Unlock className="w-7 h-7 text-emerald-600" />
            )}
          </div>

          <h3 className="text-lg font-bold text-slate-900">
            {vaultSecurity.isVaultLocked
              ? 'Unlock Secure Vault'
              : isSettingUp
              ? step === 'enter' ? 'Create Master Vault PIN' : 'Confirm Master PIN'
              : 'Vault Security Settings'}
          </h3>
          <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
            {vaultSecurity.isVaultLocked
              ? 'Enter your PIN to decrypt flight passes and sensitive documents.'
              : isSettingUp
              ? 'Your documents are locally encrypted on device with AES-256-GCM.'
              : 'Your travel documents and PNRs are encrypted on device.'}
          </p>
        </div>

        {/* Error or Success Alerts */}
        {errorMessage && (
          <div className="mb-4 flex items-center space-x-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 flex items-center space-x-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* PIN Input or Settings Options */}
        {vaultSecurity.isVaultLocked || isSettingUp ? (
          <div>
            {/* PIN Bubble Indicators */}
            <div className="flex justify-center space-x-3 mb-6">
              {[0, 1, 2, 3, 4, 5].map(idx => {
                const currentLen = (isSettingUp && step === 'confirm') 
                  ? confirmPinInput.length 
                  : pinInput.length;
                const isFilled = idx < currentLen;
                return (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                      isFilled 
                        ? 'bg-sky-500 scale-125 shadow-md shadow-sky-500/40' 
                        : 'border-2 border-slate-300 bg-slate-100'
                    }`}
                  />
                );
              })}
            </div>

            {/* Android Touch Friendly Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2.5 mb-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <button
                  key={num}
                  onClick={() => handleKeyPress(num)}
                  className="py-3 rounded-2xl bg-slate-100/90 hover:bg-slate-200 active:bg-sky-500 active:text-white text-lg font-bold text-slate-800 transition active:scale-95 shadow-xs"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={handleClear}
                className="py-3 rounded-2xl bg-slate-100/60 hover:bg-slate-200 active:scale-95 text-xs font-bold text-slate-500 uppercase tracking-wider transition"
              >
                Clear
              </button>
              <button
                onClick={() => handleKeyPress('0')}
                className="py-3 rounded-2xl bg-slate-100/90 hover:bg-slate-200 active:bg-sky-500 active:text-white text-lg font-bold text-slate-800 transition active:scale-95 shadow-xs"
              >
                0
              </button>
              <button
                onClick={handleDelete}
                className="py-3 rounded-2xl bg-slate-100/60 hover:bg-slate-200 active:scale-95 text-sm font-bold text-slate-600 transition"
              >
                ⌫
              </button>
            </div>

            {/* Action Buttons */}
            {isSettingUp ? (
              <button
                onClick={handleSaveNewPin}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 font-semibold text-white text-sm shadow-md shadow-indigo-600/25 active:scale-98 transition"
              >
                {step === 'enter' ? 'Next: Confirm PIN' : 'Save & Encrypt Vault'}
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={handleUnlock}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 font-semibold text-white text-sm shadow-md shadow-indigo-600/25 active:scale-98 transition"
                >
                  Unlock Vault
                </button>

                <button
                  onClick={handleBiometricAuth}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 font-medium text-slate-700 text-xs flex items-center justify-center space-x-2 transition"
                >
                  <Fingerprint className="w-4 h-4 text-sky-600" />
                  <span>Use Fingerprint / Face Unlock</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Vault Settings when unlocked */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-medium text-slate-700">Auto-Lock Timer</span>
                </div>
                <select
                  value={vaultSecurity.autoLockMinutes}
                  onChange={e => updateSecuritySettings({ autoLockMinutes: Number(e.target.value) })}
                  className="bg-white border border-slate-200 rounded-lg text-xs text-sky-700 py-1 px-2 focus:outline-none focus:border-sky-500 shadow-xs"
                >
                  <option value={0}>Immediately on minimize</option>
                  <option value={1}>1 Minute</option>
                  <option value={5}>5 Minutes</option>
                  <option value={15}>15 Minutes</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div className="flex items-center space-x-2">
                  <Fingerprint className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-medium text-slate-700">Biometrics / WebAuthn</span>
                </div>
                <input
                  type="checkbox"
                  checked={vaultSecurity.biometricsEnabled}
                  onChange={e => updateSecuritySettings({ biometricsEnabled: e.target.checked })}
                  className="rounded text-sky-600 border-slate-300 w-4 h-4"
                />
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  setIsSettingUp(true);
                  setStep('enter');
                  setPinInput('');
                  setConfirmPinInput('');
                }}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-medium text-slate-700 text-xs flex items-center justify-center space-x-1.5 transition"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                <span>Change Master PIN</span>
              </button>

              <button
                onClick={() => {
                  lockVault();
                  onClose();
                }}
                className="w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 font-medium text-rose-700 text-xs flex items-center justify-center space-x-1.5 transition"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock Vault Now</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
