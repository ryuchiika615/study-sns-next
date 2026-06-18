import {
  Chart,
  BarElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  Title,
} from "chart.js";
Chart.register(BarElement, CategoryScale, LinearScale, Legend, Tooltip, Title);
export { Chart };
