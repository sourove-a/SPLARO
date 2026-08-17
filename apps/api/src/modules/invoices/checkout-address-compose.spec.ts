import { composeDeliveryAddress } from '@splaro/config'

describe('Checkout address composition', () => {
  it('drops a thana and district typed into the street with no commas', () => {
    expect(composeDeliveryAddress('paik para ullapara sirajganj', 'Ullapara', 'Sirajganj')).toBe(
      'paik para, Ullapara, Sirajganj',
    )
  })

  it('keeps the postcode when the locality sits before it', () => {
    expect(
      composeDeliveryAddress('house number 54 road 5 sector 11 uttara dhaka 1230', 'Uttara', 'Dhaka'),
    ).toBe('house number 54 road 5 sector 11 1230, Uttara, Dhaka')
  })

  it('handles only one of thana or district being typed', () => {
    expect(composeDeliveryAddress('paik para sirajganj', 'Ullapara', 'Sirajganj')).toBe(
      'paik para, Ullapara, Sirajganj',
    )
    expect(composeDeliveryAddress('paik para ullapara', 'Ullapara', 'Sirajganj')).toBe(
      'paik para, Ullapara, Sirajganj',
    )
  })

  it('collapses a street that is nothing but the locality', () => {
    expect(composeDeliveryAddress('uttara dhaka', 'Uttara', 'Dhaka')).toBe('Uttara, Dhaka')
  })

  it('still handles comma-separated browser autofill', () => {
    expect(composeDeliveryAddress('House 5, Road 2, Dhanmondi, Dhaka', 'Dhanmondi', 'Dhaka')).toBe(
      'House 5, Road 2, Dhanmondi, Dhaka',
    )
  })

  it('strips a locality embedded in the last comma part', () => {
    expect(composeDeliveryAddress('House 5, Road 2, sector 11 uttara dhaka', 'Uttara', 'Dhaka')).toBe(
      'House 5, Road 2, sector 11, Uttara, Dhaka',
    )
  })

  it('leaves a clean street untouched', () => {
    expect(composeDeliveryAddress('paik para', 'Ullapara', 'Sirajganj')).toBe(
      'paik para, Ullapara, Sirajganj',
    )
  })

  it('does not eat a road genuinely named after its area', () => {
    // Thana already sits in the street name — do not append a second copy.
    expect(composeDeliveryAddress('Dhanmondi 27, Road 5', 'Dhanmondi', 'Dhaka')).toBe(
      'Dhanmondi 27, Road 5, Dhaka',
    )
    expect(composeDeliveryAddress('village kachua bazar', 'Kachua', 'Bagerhat')).toBe(
      'village kachua bazar, Bagerhat',
    )
  })

  it('forgives a one-letter locality typo at the end', () => {
    expect(composeDeliveryAddress('paik para ullpara sirajganj', 'Ullapara', 'Sirajganj')).toBe(
      'paik para, Ullapara, Sirajganj',
    )
  })

  it('does not append a locality already written at the start of the street', () => {
    expect(composeDeliveryAddress('uttara sector 11 road 5', 'Uttara', 'Dhaka')).toBe(
      'uttara sector 11 road 5, Dhaka',
    )
  })

  it('collapses the whole address pasted twice, with or without commas', () => {
    expect(
      composeDeliveryAddress(
        'paik para ullapara sirajganj paik para ullapara sirajganj',
        'Ullapara',
        'Sirajganj',
      ),
    ).toBe('paik para, Ullapara, Sirajganj')
    expect(
      composeDeliveryAddress(
        'paik para, Ullapara, Sirajganj, paik para, Ullapara, Sirajganj',
        'Ullapara',
        'Sirajganj',
      ),
    ).toBe('paik para, Ullapara, Sirajganj')
  })
})
