// chartView.js
import { listenForGraphData } from "./pollData.js";

let cachedPolls = [];          // 실시간 투표 캐시
let chartInstance = null;     // Chart.js 인스턴스
let currentPollId = null;     // 현재 선택된 투표 ID

// ====== Firestore 실시간 데이터 캐싱 ======
listenForGraphData((polls) => {
    cachedPolls = polls;

    // 현재 보고 있는 투표가 있다면 실시간으로 그래프 갱신
    if (currentPollId) {
        renderChart();
    }
});

// ====== 외부에서 호출할 함수 ======
export function showVoteChart(pollId) {
    currentPollId = pollId;

    const section = document.getElementById("chart-section");
    if (section) {
        section.style.display = "block";

        section.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    renderChart();
}


window.showVoteChart = showVoteChart;

// ====== 차트 렌더링 ======
function renderChart() {
    if (!currentPollId) return;

    const poll = cachedPolls.find(p => p.id === currentPollId);
    if (!poll) return;

    const canvas = document.getElementById("voteChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const chartType = document.getElementById("chart-type-selector").value;

    // 기존 차트 제거
    if (chartInstance) {
        chartInstance.destroy();
    }

    // 제목 갱신
    const titleEl = document.querySelector("#chart-section h3");
    if (titleEl) {
        titleEl.textContent = `📊 "${poll.question}" 투표 결과`;
    }

    chartInstance = new Chart(ctx, {
        type: chartType,
        data: {
            labels: poll.options,
            datasets: [{
                label: "투표 수",
                data: poll.votes,
                backgroundColor: generateColors(poll.options.length),
                borderColor: "#333",
                borderWidth: 1,
                fill: chartType === "line"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 500
            },
            plugins: {
                legend: {
                    display: chartType !== "bar",
                    position: "top"
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.raw}표`
                    }
                }
            },
            scales: chartType === "bar" || chartType === "line" ? {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            } : {}
        }
    });
}

document.addEventListener("pollVoted", (e) => {
    showVoteChart(e.detail);
});

// ====== 그래프 타입 변경 시 즉시 반영 ======
document.getElementById("chart-type-selector")?.addEventListener("change", () => {
        if (currentPollId) renderChart();
    });

// ====== 색상 생성 (옵션 개수 자동 대응) ======
function generateColors(count) {
    return Array.from({ length: count }, (_, i) => {
        const hue = Math.round((360 / count) * i);
        return `hsl(${hue}, 70%, 55%)`;
    });
}
