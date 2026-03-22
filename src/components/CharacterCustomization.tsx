import React, { useState, useEffect, useRef } from 'react';
import { drawPlayer } from '../game/render';
import { createInitialState, GameState } from '../game/types';
import { User, Check, ChevronLeft, ChevronRight } from 'lucide-react';

interface CharacterCustomizationProps {
  onComplete: (customization: any) => void;
  onBack?: () => void;
  initialData?: any;
}

const GENDERS = ['male', 'female', 'non-binary'];
const HAIR_STYLES = ['short', 'long', 'bob', 'curly', 'ponytail', 'bald'];
const HAIR_COLORS = ['#5d4037', '#3e2723', '#212121', '#d4a373', '#fefae0', '#bc6c25', '#dda15e'];
const SKIN_COLORS = ['#ffe0b2', '#ffcc80', '#f5cba7', '#e59866', '#d35400', '#873600', '#5d4037'];
const EYE_COLORS = ['#3e2723', '#212121', '#1565c0', '#2e7d32', '#5d4037'];
const ACCESSORIES = ['none', 'glasses', 'hat', 'scarf'];
const FACIAL_FEATURES = ['none', 'beard', 'freckles', 'blush'];

export const CharacterCustomization: React.FC<CharacterCustomizationProps> = ({ onComplete, onBack, initialData }) => {
  const [gender, setGender] = useState(initialData?.gender || 'non-binary');
  const [hairStyle, setHairStyle] = useState(initialData?.hairStyle || 'short');
  const [hairColor, setHairColor] = useState(initialData?.hairColor || HAIR_COLORS[0]);
  const [skinColor, setSkinColor] = useState(initialData?.skinColor || SKIN_COLORS[0]);
  const [eyeColor, setEyeColor] = useState(initialData?.eyeColor || EYE_COLORS[0]);
  const [accessory, setAccessory] = useState(initialData?.accessory || 'none');
  const [facialFeature, setFacialFeature] = useState(initialData?.facialFeature || 'none');
  const [displayName, setDisplayName] = useState(initialData?.displayName || '');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewState] = useState<GameState>(() => {
    const state = createInitialState();
    state.player.x = 0;
    state.player.y = 0;
    state.camera.x = 0;
    state.camera.y = 0;
    return state;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      previewState.player.gender = gender;
      previewState.player.hairStyle = hairStyle;
      previewState.player.hairColor = hairColor;
      previewState.player.skinColor = skinColor;
      previewState.player.eyeColor = eyeColor;
      previewState.player.accessory = accessory;
      previewState.player.facialFeature = facialFeature;
      previewState.player.animFrame += 0.05;
      previewState.player.facing = 'down';

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2 + 20);
      ctx.scale(3, 3); // Zoom in for preview
      
      // Draw a simple floor circle for the preview
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.beginPath();
      ctx.ellipse(0, 12, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      drawPlayer(ctx, previewState.player as any);
      
      ctx.restore();
      requestAnimationFrame(render);
    };

    const animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [gender, hairStyle, hairColor, skinColor, eyeColor, accessory, facialFeature]);

  const handleComplete = () => {
    onComplete({
      gender,
      hairStyle,
      hairColor,
      skinColor,
      eyeColor,
      accessory,
      facialFeature,
      displayName: displayName.trim() || 'Player'
    });
  };

  const OptionRow = ({ label, options, current, setter, isColor = false }: any) => (
    <div className="mb-4">
      <label className="block text-stone-400 text-xs uppercase tracking-wider mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt: string) => (
          <button
            key={opt}
            onClick={() => setter(opt)}
            className={`
              ${isColor ? 'w-8 h-8 rounded-full border-2' : 'px-3 py-1 rounded-lg text-sm border'}
              ${current === opt 
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-200' 
                : 'border-stone-700 bg-stone-800 text-stone-400 hover:border-stone-600'}
              transition-all flex items-center justify-center
            `}
            style={isColor ? { backgroundColor: opt } : {}}
          >
            {isColor ? (current === opt && <Check className="w-4 h-4 text-white drop-shadow-md" />) : opt}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row gap-8 bg-stone-900 p-8 rounded-2xl border border-stone-800 shadow-2xl max-w-4xl w-full">
      <div className="flex-1 flex flex-col items-center justify-center bg-stone-950 rounded-xl border border-stone-800 p-8">
        <h2 className="text-xl font-bold text-stone-100 mb-6 flex items-center gap-2">
          <User className="w-5 h-5 text-emerald-500" />
          Character Preview
        </h2>
        <canvas 
          ref={canvasRef} 
          width={200} 
          height={250} 
          className="bg-stone-900 rounded-lg border border-stone-800 shadow-inner"
        />
        <p className="mt-4 text-stone-500 text-sm italic">"Looking cozy!"</p>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[600px] pr-4 custom-scrollbar">
        <h2 className="text-2xl font-bold text-stone-100 mb-6">Customize Your Avatar</h2>
        
        <div className="mb-6">
          <label className="block text-stone-400 text-xs uppercase tracking-wider mb-2">Display Name</label>
          <input 
            type="text" 
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your name..."
            maxLength={20}
            className="w-full bg-stone-800 border border-stone-700 rounded-lg px-4 py-2 text-stone-200 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <OptionRow label="Gender" options={GENDERS} current={gender} setter={setGender} />
        <OptionRow label="Skin Tone" options={SKIN_COLORS} current={skinColor} setter={setSkinColor} isColor />
        <OptionRow label="Hair Style" options={HAIR_STYLES} current={hairStyle} setter={setHairStyle} />
        <OptionRow label="Hair Color" options={HAIR_COLORS} current={hairColor} setter={setHairColor} isColor />
        <OptionRow label="Eye Color" options={EYE_COLORS} current={eyeColor} setter={setEyeColor} isColor />
        <OptionRow label="Facial Features" options={FACIAL_FEATURES} current={facialFeature} setter={setFacialFeature} />
        <OptionRow label="Accessories" options={ACCESSORIES} current={accessory} setter={setAccessory} />

        <div className="flex gap-4 mt-8">
          {onBack && (
            <button
              onClick={onBack}
              className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold py-3 rounded-xl transition-all border border-stone-700 flex items-center justify-center gap-2"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>
          )}
          <button
            onClick={handleComplete}
            className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            Finalize Character
          </button>
        </div>
      </div>
    </div>
  );
};
