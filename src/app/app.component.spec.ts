import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { Link } from './links.service';

describe('AppComponent', () => {
  const endpoint = 'http://localhost:3000/api/links';
  const link: Link = {
    code: 'Ab12Cd',
    url: 'https://example.com/article',
    shortUrl: 'http://localhost:3000/Ab12Cd',
    hits: 3,
    createdAt: '2026-10-29T08:00:00.000Z'
  };
  let fixture: ComponentFixture<AppComponent>;
  let app: AppComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    fixture = TestBed.createComponent(AppComponent);
    app = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('loads and renders links with their short URLs and hit counts', () => {
    const request = http.expectOne(endpoint);
    expect(request.request.method).toBe('GET');
    request.flush([link]);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('h1')?.textContent).toBe('Snip');
    expect(element.querySelector('tbody a')?.getAttribute('href')).toBe(link.shortUrl);
    expect(element.querySelector('tbody')?.textContent).toContain(link.url);
    expect(element.querySelector('tbody .hits')?.textContent).toContain('3');
  });

  it('rejects invalid and non-HTTP(S) URLs without sending a request', () => {
    http.expectOne(endpoint).flush([]);
    for (const url of ['', 'not a URL', 'ftp://example.com', 'javascript:alert(1)']) {
      app.url.set(url);
      app.shorten();
      expect(app.formError()).toContain('http:// or https://');
      http.expectNone(endpoint);
    }
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent)
      .toContain('Enter a valid URL');
  });

  it('submits the form, shows the result, and adds the created link to the table', () => {
    http.expectOne(endpoint).flush([]);
    const element: HTMLElement = fixture.nativeElement;
    const input = element.querySelector('input')!;
    input.value = `  ${link.url}  `;
    input.dispatchEvent(new Event('input'));
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    const request = http.expectOne(endpoint);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ url: link.url });
    expect(app.submitting()).toBeTrue();
    expect(element.querySelector('button')?.disabled).toBeTrue();
    request.flush({ ...link, hits: 0 }, { status: 201, statusText: 'Created' });
    fixture.detectChanges();

    expect(app.submitting()).toBeFalse();
    expect(app.url()).toBe('');
    expect(element.querySelector('.success a')?.textContent).toContain(link.shortUrl);
    expect(element.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('displays API errors inline and enables the form for retry', () => {
    http.expectOne(endpoint).flush([]);
    app.url.set(link.url);
    app.shorten();
    http.expectOne(endpoint).flush(
      { error: 'Invalid URL from API' }, { status: 400, statusText: 'Bad Request' }
    );
    fixture.detectChanges();
    expect(app.formError()).toBe('Invalid URL from API');
    expect(app.submitting()).toBeFalse();
    expect(fixture.nativeElement.querySelector('#form-error').textContent)
      .toContain('Invalid URL from API');
    expect(app.url()).toBe(link.url);
  });

  it('shows network errors and supports refreshing after a failed load', () => {
    http.expectOne(endpoint).error(new ProgressEvent('error'));
    expect(app.listError()).toContain('Cannot reach the backend');
    expect(app.loading()).toBeFalse();
    app.refresh();
    http.expectOne(endpoint).flush([link]);
    expect(app.listError()).toBe('');
    expect(app.links()).toEqual([link]);

    app.url.set(link.url);
    app.shorten();
    http.expectOne(endpoint).error(new ProgressEvent('error'));
    expect(app.formError()).toContain('Cannot reach the backend');
    expect(app.submitting()).toBeFalse();
  });

  it('refreshes hit counts and keeps existing links visible on failure', () => {
    http.expectOne(endpoint).flush([link]);
    app.refresh();
    http.expectOne(endpoint).flush([{ ...link, hits: 4 }]);
    expect(app.links()[0].hits).toBe(4);
    app.refresh();
    http.expectOne(endpoint).flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    expect(app.listError()).toContain('HTTP 503');
    expect(app.links()[0].hits).toBe(4);
  });

  it('retains a newly created link if an older list request finishes afterward', () => {
    const initialRequest = http.expectOne(endpoint);
    app.url.set(link.url);
    app.shorten();
    http.expectOne(endpoint).flush(link);
    initialRequest.flush([]);
    expect(app.links()).toEqual([link]);
  });
});
