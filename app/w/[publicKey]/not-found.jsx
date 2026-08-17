export default function PublicWidgetNotFound() {
  return (
    <div className="flex h-dvh items-center justify-center bg-white p-6 text-center">
      <div>
        <p className="text-sm font-semibold text-slate-900">Chat unavailable</p>
        <p className="mt-1 text-sm text-slate-500">
          This widget is missing or embed is turned off.
        </p>
      </div>
    </div>
  );
}
