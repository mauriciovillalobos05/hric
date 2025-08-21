#!/usr/bin/env bash
set -euo pipefail

# -- helpers ------------------------------------------------------------------
sedi() {
  # Usage: sedi 's|from|to|g' file
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' -E "$1" "$2"
  else
    sed -i -E "$1" "$2"
  fi
}

# -- ensure dirs ---------------------------------------------------------------
mkdir -p src/assets \
         src/components \
         src/pages/hooks \
         src/pages/contexts \
         src/dashboards/investors-dashboard/dashboard-components/components/matchComponents/components

# -- CASE/PATH FIXES -----------------------------------------------------------

# investorTabs.jsx: RegisterModal -> registerModal.jsx
if [[ -f src/dashboards/investors-dashboard/dashboard-components/components/investorTabs.jsx ]]; then
  sedi 's|@/pages/eventShowcaseComponents/RegisterModal(\.jsx)?|@/pages/eventShowcaseComponents/registerModal.jsx|g' \
       src/dashboards/investors-dashboard/dashboard-components/components/investorTabs.jsx
fi

# matchFeed.jsx: MatchCard -> matchCard.jsx (same folder)
if [[ -f src/dashboards/investors-dashboard/dashboard-components/components/matchComponents/matchFeed.jsx ]]; then
  sedi 's|\.\/matchComponents\/MatchCard(\.jsx)?|./matchCard.jsx|g' \
       src/dashboards/investors-dashboard/dashboard-components/components/matchComponents/matchFeed.jsx
  # also catch any deep path variant
  sedi 's|MatchCard(\.jsx)?|matchCard.jsx|g' \
       src/dashboards/investors-dashboard/dashboard-components/components/matchComponents/matchFeed.jsx
fi

# matchesDashboard.jsx: wrong subfolder "components/" for these
if [[ -f src/dashboards/investors-dashboard/dashboard-components/components/matchComponents/matchesDashboard.jsx ]]; then
  sedi 's|\./components/MonteCarloResults(\.jsx)?|./MonteCarloResults.jsx|g' \
       src/dashboards/investors-dashboard/dashboard-components/components/matchComponents/matchesDashboard.jsx
  sedi 's|\./components/SpiderChart(\.jsx)?|./SpiderChart.jsx|g' \
       src/dashboards/investors-dashboard/dashboard-components/components/matchComponents/matchesDashboard.jsx
fi

# Onboarding.jsx: LocationAutocomplete -> locationAutoComplete.jsx
if [[ -f src/pages/Onboarding.jsx ]]; then
  sedi 's|@/components/LocationAutocomplete(\.jsx)?|@/components/locationAutoComplete.jsx|g' \
       src/pages/Onboarding.jsx
fi

# -- CREATE / SHIM MISSING FILES ----------------------------------------------

# src/index.css (tailwind v4 entry)
if [[ ! -f src/index.css ]]; then
  printf '%s\n' '@import "tailwindcss";' > src/index.css
  echo "Created src/index.css"
fi

# placeholder images (1x1 transparent png) via node to avoid base64 flags variance
node - <<'NODE'
const fs = require('fs'), path = require('path');
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
function writeIfMissing(p) {
  if (!fs.existsSync(p)) fs.writeFileSync(p, Buffer.from(png, 'base64'));
}
writeIfMissing(path.join('src','assets','hrcposter.png'));
writeIfMissing(path.join('src','assets','default_user_image.png'));
NODE

# shims for hooks/contexts referenced by enhanced_portfolio_component.js
if [[ ! -f src/pages/hooks/useData.js ]]; then
  cat > src/pages/hooks/useData.js <<'JS'
export function useData() { return { data: null, loading: false, error: null }; }
export default useData;
JS
  echo "Created shim src/pages/hooks/useData.js"
fi
if [[ ! -f src/pages/contexts/AuthContext.js ]]; then
  cat > src/pages/contexts/AuthContext.js <<'JS'
import { createContext, useContext } from "react";
export const AuthContext = createContext({ user: null, token: null });
export const useAuth = () => useContext(AuthContext);
export default AuthContext;
JS
  echo "Created shim src/pages/contexts/AuthContext.js"
fi

# If investors path expects ./components/Dashboard.jsx and it's missing,
# copy the entrepreneurs version as a temporary shim (if it exists).
if [[ ! -f src/dashboards/investors-dashboard/dashboard-components/components/matchComponents/components/Dashboard.jsx ]] \
   && [[ -f src/dashboards/entrepreneurs-dashboard/dashboard-components/components/matchComponents/components/Dashboard.jsx ]]; then
  cp src/dashboards/entrepreneurs-dashboard/dashboard-components/components/matchComponents/components/Dashboard.jsx \
     src/dashboards/investors-dashboard/dashboard-components/components/matchComponents/components/Dashboard.jsx
  echo "Copied entrepreneurs Dashboard.jsx into investors path (temporary)."
fi

# -- COMMIT & REPORT -----------------------------------------------------------
git add -A
git commit -m "fix: import casing/paths; add missing css/images; add shims" || true

echo
echo "=== Running import checker ==="
node scripts/check-imports.mjs || true
echo "=== Done. If any MISSING/CASE_MISMATCH remain above, we can fix those next. ==="
