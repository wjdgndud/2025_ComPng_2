// graph.js
import { listenForGraphData } from "./pollData.js";

const container = document.getElementById("network");
const resetBtn = document.getElementById("reset-filter-btn");

let network = null;

// 1. [디자인] 대분류(추천 태그) 색상 팔레트 (18개로 확장)
const TAG_COLORS = {
    "IT": "#2E7D32",       // 진한 초록
    "게임": "#673AB7",      // 보라
    "음식": "#E65100",      // 아주 진한 주황
    "여행": "#0277BD",      // 진한 파랑
    "스포츠": "#D32F2F",    // 빨강
    "음악": "#1565C0",      // 남색
    "영화": "#AD1457",      // 진한 분홍
    "책": "#5D4037",        // 갈색
    "패션": "#7B1FA2",      // 자주
    "학교": "#00695C",      // 청록
    "연애": "#F50057",      // 핫핑크
    "고민": "#546E7A",      // 블루그레이
    "정치": "#37474F",      // 진한 회색
    "경제": "#F9A825",      // 골드/노랑 (글씨 잘 보이게 어두운 노랑)
    "진로": "#283593",      // 인디고
    "반려동물": "#8D6E63",  // 연갈색
    "건강": "#558B2F",      // 올리브
    "취미": "#EF6C00"       // 오렌지
};

// 소분류 기본 색상
const DEFAULT_COLOR = "#B0BEC5"; 

// vis-network 옵션
const options = {
    nodes: {
        borderWidth: 2,
        shadow: true,
        font: { face: "arial" }
    },
    edges: {
        width: 2,
        color: { color: "#CFD8DC", highlight: "#607D8B" },
        smooth: { type: "continuous" }
    },
    physics: {
        stabilization: false,
        barnesHut: { 
            gravitationalConstant: -5000, 
            springConstant: 0.02, 
            springLength: 130 
        }
    },
    interaction: { hover: true }
};

listenForGraphData((polls) => {
    drawCoOccurrenceGraph(polls);
});

function drawCoOccurrenceGraph(polls) {
    const nodesMap = new Map();
    const edgesMap = new Map();
    const tagCounts = {}; 

    // 1. 빈도수 집계
    polls.forEach(poll => {
        (poll.tags || []).forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
    });

    // 2. 색상 상속 계산
    const tagColorMap = {};
    polls.forEach(poll => {
        const tags = poll.tags || [];
        let majorColor = null;
        for (const tag of tags) {
            if (TAG_COLORS[tag]) { majorColor = TAG_COLORS[tag]; break; }
        }
        if (majorColor) {
            tags.forEach(tag => {
                if (!TAG_COLORS[tag] && !tagColorMap[tag]) tagColorMap[tag] = majorColor;
            });
        }
    });

    // 3. 노드 생성 (가시성 핵심 로직)
    polls.forEach(poll => {
        const tags = poll.tags || [];
        tags.forEach(tag => {
            if (!nodesMap.has(tag)) {
                const count = tagCounts[tag];
                const isMajor = TAG_COLORS.hasOwnProperty(tag);
                
                // 색상 결정
                const color = TAG_COLORS[tag] || tagColorMap[tag] || DEFAULT_COLOR;
                
                // ▼▼▼ [핵심 변경] 대분류 노드 디자인 강화 ▼▼▼
                if (isMajor) {
                    // 대분류: 'box' 모양 (글자가 박스 안에 들어감 -> 가시성 최고)
                    nodesMap.set(tag, { 
                        id: tag, 
                        label: tag, 
                        shape: "box",          // 박스 형태
                        color: {
                            background: color, // 배경색
                            border: color      // 테두리색
                        },
                        font: { 
                            size: 20 + (count * 2), // 클수록 글자도 커짐
                            color: "#ffffff",       // 흰색 글씨
                            face: "bold arial"      // 굵게
                        },
                        margin: 10, // 박스 여백
                        value: 50 + count // 물리엔진용 무게감
                    });
                } else {
                    // 소분류: 기존 'dot' 형태 유지 (작고 귀엽게)
                    nodesMap.set(tag, { 
                        id: tag, 
                        label: tag, 
                        shape: "dot",
                        color: color, 
                        size: 15 + (count * 3),
                        font: { 
                            size: 14, 
                            color: "#333", // 글자는 검정
                            strokeWidth: 4, // 흰색 테두리 (가독성 확보)
                            strokeColor: "#ffffff"
                        }
                    });
                }
            }
        });

        // 엣지 생성
        for (let i = 0; i < tags.length; i++) {
            for (let j = i + 1; j < tags.length; j++) {
                const source = tags[i];
                const target = tags[j];
                const edgeId = [source, target].sort().join("-");
                if (!edgesMap.has(edgeId)) edgesMap.set(edgeId, { from: source, to: target });
            }
        }
    });

    const data = { 
        nodes: new vis.DataSet(Array.from(nodesMap.values())), 
        edges: new vis.DataSet(Array.from(edgesMap.values())) 
    };
    
    if (network) network.destroy();
    network = new vis.Network(container, data, options);

    network.on("click", (params) => {
        if (params.nodes.length > 0) filterPollsByTag(params.nodes[0]);
    });
}

function filterPollsByTag(targetTag) {
    const allPolls = document.querySelectorAll(".poll-container");
    resetBtn.style.display = "inline-block";

    allPolls.forEach(div => {
        const tagsAttr = div.getAttribute("data-tags"); 
        const tags = tagsAttr ? tagsAttr.split(",") : [];

        if (tags.includes(targetTag)) {
            div.style.display = "flex"; // 레이아웃 유지
            // 선택된 노드의 색상을 찾아서 테두리에 적용
            const color = TAG_COLORS[targetTag] || "#555";
            div.style.border = `2px solid ${color}`;
        } else {
            div.style.display = "none";
            div.style.border = "1px solid #ddd";
        }
    });
}

resetBtn.addEventListener("click", () => {
    document.querySelectorAll(".poll-container").forEach(d => {
        d.style.display = "flex";
        d.style.border = "1px solid #ddd";
    });
    resetBtn.style.display = "none";
    if (network) network.unselectAll();
});