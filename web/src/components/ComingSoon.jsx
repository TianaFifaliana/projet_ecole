import Icon from './Icons'

export default function ComingSoon({ title, description }) {
  return (
    <div className="coming-soon">
      <span className="coming-soon-icon">
        <Icon name="construction" size={26} />
      </span>
      <strong>{title}</strong>
      <p>{description ?? 'Cette section sera disponible lors d’une prochaine étape.'}</p>
    </div>
  )
}
