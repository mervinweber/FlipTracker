import { useId, useMemo } from 'react';
import {
  buildEbayPayloadPreview,
  type EbayPayloadPreviewListing,
} from '../utils/ebayPayloadPreview';

export type EbayPayloadPreviewProps = {
  listing: EbayPayloadPreviewListing;
  heading?: string;
  className?: string;
};

type PreviewFieldProps = {
  label: string;
  value: string;
};

function PreviewField({ label, value }: PreviewFieldProps) {
  return (
    <div className="ebayPayloadPreviewField">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Read-only, network-free preview of the fields FlipTracker will send to eBay. */
export default function EbayPayloadPreview({
  listing,
  heading = 'eBay payload preview',
  className = '',
}: EbayPayloadPreviewProps) {
  const preview = useMemo(() => buildEbayPayloadPreview(listing), [listing]);
  const classes = ['ebayPayloadPreview', className].filter(Boolean).join(' ');
  const headingId = useId();
  const sectionId = (name: string) => `${headingId}-${name}`;

  return (
    <section className={classes} aria-labelledby={headingId}>
      <header className="ebayPayloadPreviewHeader">
        <div>
          <p className="eyebrow">Review before staging</p>
          <h2 id={headingId}>{heading}</h2>
        </div>
        <span className="statusPill">Read only</span>
      </header>

      <div className="ebayPayloadPreviewSections">
        <section aria-labelledby={sectionId('title')}>
          <h3 id={sectionId('title')}>Title</h3>
          <p>{preview.title}</p>
        </section>

        <section aria-labelledby={sectionId('category')}>
          <h3 id={sectionId('category')}>Category</h3>
          <dl>
            <PreviewField label="Category ID" value={preview.category.id}/>
            <PreviewField label="Category" value={preview.category.label}/>
          </dl>
        </section>

        <section aria-labelledby={sectionId('condition')}>
          <h3 id={sectionId('condition')}>Condition</h3>
          <dl>
            <PreviewField label="Condition" value={preview.condition.name}/>
            <PreviewField label="Condition ID" value={preview.condition.id}/>
          </dl>
        </section>

        <section aria-labelledby={sectionId('specifics')}>
          <h3 id={sectionId('specifics')}>Item specifics</h3>
          {preview.specifics.length ? (
            <dl>
              {preview.specifics.map((specific) => (
                <PreviewField
                  key={specific.name.toLocaleLowerCase()}
                  label={specific.name}
                  value={specific.values.join(', ')}
                />
              ))}
            </dl>
          ) : <p>Not provided</p>}
        </section>

        <section aria-labelledby={sectionId('description')}>
          <h3 id={sectionId('description')}>Description</h3>
          <p className="ebayPayloadPreviewDescription">{preview.description}</p>
        </section>

        <section aria-labelledby={sectionId('photos')}>
          <h3 id={sectionId('photos')}>Photos</h3>
          {preview.photos.length ? (
            <ol className="ebayPayloadPreviewPhotos">
              {preview.photos.map((photo) => (
                <li key={photo.url}>
                  <img src={photo.url} alt={photo.label}/>
                  <span>{photo.label}</span>
                  <small>{photo.url}</small>
                </li>
              ))}
            </ol>
          ) : <p>Not provided</p>}
        </section>

        <section aria-labelledby={sectionId('price')}>
          <h3 id={sectionId('price')}>Price</h3>
          <dl>
            <PreviewField label="Amount" value={preview.price.formatted}/>
            <PreviewField label="Currency" value={preview.price.currency}/>
          </dl>
        </section>

        <section aria-labelledby={sectionId('package')}>
          <h3 id={sectionId('package')}>Package</h3>
          <dl>
            <PreviewField label="Package type" value={preview.package.type}/>
            <PreviewField label="Weight" value={preview.package.weight}/>
            <PreviewField label="Dimensions" value={preview.package.dimensions}/>
          </dl>
        </section>

        <section aria-labelledby={sectionId('policies')}>
          <h3 id={sectionId('policies')}>Policy IDs</h3>
          <dl>
            <PreviewField label="Fulfillment" value={preview.policies.fulfillment}/>
            <PreviewField label="Payment" value={preview.policies.payment}/>
            <PreviewField label="Returns" value={preview.policies.returns}/>
            <PreviewField label="Inventory location" value={preview.policies.inventoryLocation}/>
          </dl>
        </section>
      </div>
    </section>
  );
}
