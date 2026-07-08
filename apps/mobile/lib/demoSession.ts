let demoSessionActive = false;

export function activateDemoSession() {
  demoSessionActive = true;
}

export function isDemoSessionActive() {
  return demoSessionActive;
}
