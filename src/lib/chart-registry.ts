import {
  Chart,
  BarController,
  DoughnutController,
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  Title,
} from "chart.js";
Chart.register(BarController, DoughnutController, BarElement, ArcElement, CategoryScale, LinearScale, Legend, Tooltip, Title);
export { Chart };
