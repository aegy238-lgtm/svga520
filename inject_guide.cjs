const fs = require('fs');

let appTsx = fs.readFileSync('src/App.tsx', 'utf8');

if (!appTsx.includes('WelcomeGuideModal')) {
  appTsx = appTsx.replace(
    /import \{ Header \} from '.\/components\/Header';/,
    `import { Header } from './components/Header';\nimport { FeaturesGuideModal } from './components/FeaturesGuideModal';\nimport { WelcomeGuideModal } from './components/WelcomeGuideModal';`
  );
}

if (!appTsx.includes('showFeaturesGuide')) {
  // inject state
  appTsx = appTsx.replace(
    /const \[showOnboarding, setShowOnboarding\] = useState\(false\);/,
    `const [showOnboarding, setShowOnboarding] = useState(false);\n  const [showFeaturesGuide, setShowFeaturesGuide] = useState(false);\n  const [showWelcomeGuide, setShowWelcomeGuide] = useState(false);`
  );
}

if (!appTsx.includes('guide_skipped')) {
  // inject effect
  appTsx = appTsx.replace(
    /const handleCloseOnboarding = \(\) => \{/,
    `useEffect(() => {\n    const guideSkipped = localStorage.getItem('guide_skipped');\n    if (!guideSkipped) {\n      setShowWelcomeGuide(true);\n    }\n  }, []);\n\n  const handleCloseOnboarding = () => {`
  );
}

if (!appTsx.includes('<WelcomeGuideModal')) {
  // inject modals before AnimatePresence
  appTsx = appTsx.replace(
    /<AnimatePresence>/,
    `{showWelcomeGuide && (\n        <WelcomeGuideModal \n          onOpenGuide={() => {\n            setShowWelcomeGuide(false);\n            setShowFeaturesGuide(true);\n          }} \n          onSkip={() => {\n            setShowWelcomeGuide(false);\n            localStorage.setItem('guide_skipped', 'true');\n          }}\n        />\n      )}\n      \n      {showFeaturesGuide && (\n        <FeaturesGuideModal onClose={() => {\n          setShowFeaturesGuide(false);\n          localStorage.setItem('guide_skipped', 'true');\n        }} />\n      )}\n\n      <AnimatePresence>`
  );
}

if (!appTsx.includes('onOpenGuide={() => setShowFeaturesGuide(true)}')) {
  // inject prop into Header
  appTsx = appTsx.replace(
    /<Header\s+/,
    `<Header \n        onOpenGuide={() => setShowFeaturesGuide(true)}\n        `
  );
}

fs.writeFileSync('src/App.tsx', appTsx);
console.log('App.tsx patched successfully');
