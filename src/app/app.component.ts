import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { Link, LinksService } from './links.service';

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private readonly linksService = inject(LinksService);

  readonly url = signal('');
  readonly links = signal<Link[]>([]);
  readonly createdLink = signal<Link | null>(null);
  readonly formError = signal('');
  readonly listError = signal('');
  readonly submitting = signal(false);
  readonly loading = signal(false);

  ngOnInit(): void {
    this.refresh();
  }

  shorten(): void {
    if (this.submitting()) return;
    this.formError.set('');
    this.createdLink.set(null);

    const url = this.url().trim();
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
        throw new Error('Unsupported URL');
      }
    } catch {
      this.formError.set('Enter a valid URL starting with http:// or https://.');
      return;
    }

    this.submitting.set(true);
    this.linksService.create(url).pipe(
      finalize(() => this.submitting.set(false))
    ).subscribe({
      next: (link) => {
        this.createdLink.set(link);
        this.links.update((links) => [...links, link]);
        this.url.set('');
      },
      error: (error: unknown) => this.formError.set(this.errorMessage(error))
    });
  }

  refresh(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.listError.set('');
    this.linksService.list().pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: (links) => {
        // A create request may finish while this list request is in flight.
        const createdLink = this.createdLink();
        this.links.set(
          createdLink && !links.some((link) => link.code === createdLink.code)
            ? [...links, createdLink]
            : links
        );
      },
      error: (error: unknown) => this.listError.set(this.errorMessage(error))
    });
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Cannot reach the backend. Check that it is running at http://localhost:3000.';
      }
      const body: unknown = error.error;
      if (typeof body === 'object' && body !== null && 'error' in body &&
          typeof body.error === 'string') {
        return body.error;
      }
      return `Request failed (HTTP ${error.status}). Please try again.`;
    }
    return 'An unexpected error occurred. Please try again.';
  }
}
