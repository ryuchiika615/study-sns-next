import {
  Chart,
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  Title,
} from "chart.js";
Chart.register(BarElement, ArcElement, CategoryScale, LinearScale, Legend, Tooltip, Title);
export { Chart };
