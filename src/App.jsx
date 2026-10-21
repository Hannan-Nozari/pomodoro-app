import React from 'react'
import Timer from './components/Timer'
import AdvancedPanel from './components/AdvancedPanel'
import { usePomodoro } from './hooks/usePomodoro'

export default function App() {
  const {
    timeLeft, sessionType, sessionNum, displaySession, totalSessions,
    isRunning, isFinished, progress,
    start, pause, reset, switchTo,
    durations, setDurations,
    alertStyle, setAlertStyle, soundEnabled, nativeAlerts,
    tasks, addTask, toggleTask, deleteTask, activeTaskId, setActiveTask, activeTask,
    history, clearHistory, setSessionNote,
    alarmSound, setAlarmSound, previewAlarm,
    dndEnabled, setDndEnabled, dndGranted, dndSupported, requestDndAccess,
  } = usePomodoro()

  return (
    // Full-page centering with a subtle gradient background
    <div className="min-h-screen bg-gradient-to-b from-white to-tomato-lighter flex flex-col items-center justify-start px-4 py-10">

      {/* App card */}
      <main className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-gray-100 px-6 py-8 flex flex-col gap-8">

        {/* Wordmark */}
        <header className="text-center">
          <h1 className="text-lg font-bold text-tomato tracking-tight">
            Pomodoro
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">stay focused · one session at a time</p>
        </header>

        {/* Timer section */}
        <Timer
          timeLeft={timeLeft}
          sessionType={sessionType}
          sessionNum={sessionNum}
          displaySession={displaySession}
          totalSessions={totalSessions}
          isRunning={isRunning}
          isFinished={isFinished}
          progress={progress}
          activeTask={activeTask}
          onStart={start}
          onPause={pause}
          onReset={reset}
          onSwitch={switchTo}
        />

        {/* Divider */}
        <div className="border-t border-gray-100" />

        {/* Advanced panel (collapsed by default) */}
        <AdvancedPanel
          durations={durations}
          onDurationsChange={setDurations}
          alertStyle={alertStyle}
          onAlertStyleChange={setAlertStyle}
          soundEnabled={soundEnabled}
          nativeAlerts={nativeAlerts}
          dndEnabled={dndEnabled}
          onDndToggle={setDndEnabled}
          onGrantDnd={requestDndAccess}
          dndGranted={dndGranted}
          dndSupported={dndSupported}
          tasks={tasks}
          onAddTask={addTask}
          onToggleTask={toggleTask}
          onDeleteTask={deleteTask}
          activeTaskId={activeTaskId}
          onSelectTask={setActiveTask}
          history={history}
          onClearHistory={clearHistory}
          onSessionNote={setSessionNote}
          alarmSound={alarmSound}
          onAlarmSoundChange={setAlarmSound}
          onPreviewAlarm={previewAlarm}
        />

      </main>

      {/* Footer */}
      <footer className="mt-6 text-xs text-gray-300">
        All data stays on your device
      </footer>
    </div>
  )
}
