import { sizeCharts } from '@/lib/content/site-pages'

export function SizeGuideTables() {
  return (
    <div className="content-page__charts">
      {(Object.keys(sizeCharts) as Array<keyof typeof sizeCharts>).map((key) => {
        const chart = sizeCharts[key]
        return (
          <div key={key} className="content-page__chart">
            <h2 className="content-page__section-title">{chart.title}</h2>
            <div className="content-page__table-wrap">
              <table className="content-page__table">
                <thead>
                  <tr>
                    {chart.headers.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chart.rows.map((row) => (
                    <tr key={row[0]}>
                      {row.map((cell) => (
                        <td key={cell}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
