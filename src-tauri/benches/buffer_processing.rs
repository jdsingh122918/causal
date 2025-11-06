use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use causal_lib::transcription::buffer::TranscriptionBuffer;

fn create_buffer_with_text(turn_order: u32, text_count: usize) -> TranscriptionBuffer {
    let mut buffer = TranscriptionBuffer::new(turn_order);
    for i in 0..text_count {
        buffer.add_text(format!("This is test text number {}", i));
    }
    buffer
}

fn bench_buffer_creation(c: &mut Criterion) {
    c.bench_function("buffer_creation", |b| {
        b.iter(|| {
            TranscriptionBuffer::new(black_box(1))
        });
    });
}

fn bench_buffer_add_text(c: &mut Criterion) {
    let mut group = c.benchmark_group("buffer_add_text");

    for text_count in [1, 10, 50, 100].iter() {
        group.bench_with_input(
            BenchmarkId::from_parameter(text_count),
            text_count,
            |b, &count| {
                b.iter(|| {
                    let mut buffer = TranscriptionBuffer::new(1);
                    for i in 0..count {
                        buffer.add_text(format!("Text {}", i));
                    }
                });
            },
        );
    }

    group.finish();
}

fn bench_buffer_combined_text(c: &mut Criterion) {
    let mut group = c.benchmark_group("buffer_combined_text");

    for text_count in [1, 10, 50, 100].iter() {
        let buffer = create_buffer_with_text(1, *text_count);
        group.bench_with_input(
            BenchmarkId::from_parameter(text_count),
            &buffer,
            |b, buf| {
                b.iter(|| {
                    black_box(buf.combined_text())
                });
            },
        );
    }

    group.finish();
}

fn bench_buffer_should_flush(c: &mut Criterion) {
    let buffer = create_buffer_with_text(1, 10);

    c.bench_function("buffer_should_flush", |b| {
        b.iter(|| {
            black_box(buffer.should_flush(10))
        });
    });
}

criterion_group!(
    benches,
    bench_buffer_creation,
    bench_buffer_add_text,
    bench_buffer_combined_text,
    bench_buffer_should_flush
);
criterion_main!(benches);
