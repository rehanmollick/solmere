export default function Loader({ ready }) {
  return (
    <div className={`loader${ready ? ' loader-done' : ''}`} aria-hidden={ready}>
      <p className="loader-word">Solmere</p>
      <span className="loader-tide" />
      <p className="loader-note">waiting for the tide</p>
    </div>
  )
}
